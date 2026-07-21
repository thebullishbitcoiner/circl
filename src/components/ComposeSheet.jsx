import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { draftId as computeDraftId } from "../hooks/useDrafts.js";
import { useDraftsContext } from "../contexts/DraftsContext.jsx";
import Overlay from "./Overlay.jsx";
import { sheetPortal } from "../utils/sheetPortal.js";
import Avatar from "./Avatar.jsx";
import { displayName, avatarInitial, replyTagsForPublish, kind1111TagsForPublish, extractContentTags, nip19 } from "../utils.js";
import { DEFAULT_RELAYS } from "../constants.js";
import { broadcastEvent, pool } from "../nostr.js";
import EmojiPicker from "./EmojiPicker.jsx";
import PollCompose from "./PollCompose.jsx";
import GoalCompose from "./GoalCompose.jsx";
import ThreadCompose, { makeThreadPost } from "./ThreadCompose.jsx";
import { uploadFile } from "../utils/upload.js";
import { VoiceRecorderBody } from "./VoiceRecorderSheet.jsx";
import useRichTextEditor from "../hooks/useRichTextEditor.js";
import useGifPicker from "../hooks/useGifPicker.js";

const TAGGING_FONT = "12.5px 'DM Sans', sans-serif";
let _measureCanvas = null;
function measureText(text) {
  if (!_measureCanvas) { _measureCanvas = document.createElement("canvas"); _measureCanvas.getContext("2d").font = TAGGING_FONT; }
  const ctx = _measureCanvas.getContext("2d");
  ctx.font = TAGGING_FONT;
  return ctx.measureText(text).width;
}

function buildTagLabel(pubkeys, excludedMentions, profiles, availableWidth) {
  const active = pubkeys.filter(pk => !excludedMentions.has(pk));
  if (!active.length) return "no one";
  const names = active.map(pk => displayName(pk, profiles));
  const total = names.length;
  if (!availableWidth) return total === 1 ? names[0] : `${names[0]} and ${total - 1} other${total - 1 !== 1 ? "s" : ""}`;
  for (let n = total; n >= 1; n--) {
    const rem = total - n;
    const text = names.slice(0, n).join(", ") + (rem > 0 ? ` and ${rem} other${rem !== 1 ? "s" : ""}` : "");
    if (measureText(text) <= availableWidth) return text;
  }
  return names[0];
}

function TaggingLink({ pubkeys, excludedMentions, profiles, onClick }) {
  const ref = useRef(null);
  const [label, setLabel] = useState(() => buildTagLabel(pubkeys, excludedMentions, profiles, 0));
  useEffect(() => {
    if (!ref.current) return;
    const w = ref.current.getBoundingClientRect().width;
    setLabel(buildTagLabel(pubkeys, excludedMentions, profiles, w));
  }, [pubkeys, excludedMentions, profiles]);
  return (
    <button ref={ref} type="button" className="tagging-link" onClick={onClick}
      style={{ flex: 1, minWidth: 0, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden" }}>
      {label}
    </button>
  );
}

export default function ComposeSheet({ replyTo, quotedEvent, profiles, myPubkey, myProfile, onPost, onDismiss, publishEvent, onPrepend, events = [], circles = [], initialCircle = null, customEmojis = [], blossomServers = [] }) {
  const { getDraft, saveDraft, deleteDraft } = useDraftsContext();
  const [hasText,        setHasText]        = useState(false);
  const [media,          setMedia]          = useState([]);
  const [uploading,      setUploading]      = useState(false);
  const [uploadErr,      setUploadErr]      = useState("");
  const [publishing,     setPublishing]     = useState(false);
  const [showEmoji,      setShowEmoji]      = useState(false);
  const [pollMode,       setPollMode]       = useState(false);
  const [pollType,       setPollType]       = useState("standard");
  const [pollOptions,    setPollOptions]    = useState(["", ""]);
  const [pollChoice,     setPollChoice]     = useState("singlechoice");
  const [pollExpiry,     setPollExpiry]     = useState("");
  const [zapMin,         setZapMin]         = useState("");
  const [zapMax,         setZapMax]         = useState("");
  const [goalMode,        setGoalMode]        = useState(false);
  const [goalTitle,       setGoalTitle]       = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalAmount,      setGoalAmount]      = useState("");
  const [goalClosedAt,    setGoalClosedAt]    = useState("");
  const [goalImage,       setGoalImage]       = useState("");
  const [selectedCircle,  setSelectedCircle]  = useState(initialCircle);
  const [showCirclePicker, setShowCirclePicker] = useState(false);
  const [emojiTags,       setEmojiTags]       = useState([]);
  const [excludedMentions, setExcludedMentions] = useState(new Set());
  const [showTagList,      setShowTagList]      = useState(false);
  const [activeTab, setActiveTab]   = useState(() => (replyTo?.kind === 1222 || replyTo?.kind === 1244) ? "voice" : "text");
  const [voicePhase, setVoicePhase] = useState("idle");
  const [voiceMode,  setVoiceMode]  = useState(false);
  const [threadMode,          setThreadMode]          = useState(false);
  const [threadPosts,         setThreadPosts]         = useState(() => [makeThreadPost()]);
  const [threadPublishedCount, setThreadPublishedCount] = useState(0);
  const fileRef        = useRef(null);
  const publishingRef  = useRef(false);
  const voiceSendRef   = useRef(null);
  const threadLastPublishedRef = useRef(null);

  const richText = useRichTextEditor({
    profiles, myPubkey,
    onTextChange: text => setHasText(text.trim().length > 0),
    onFilesDropped: files => uploadFiles(files),
  });
  const editorRef = richText.editorRef;
  const gifPicker = useGifPicker({ onPick: url => setMedia(m => [...m, { url, type: "gif" }]) });
  const { showGif, setShowGif, gifQuery, setGifQuery, gifs, gifLoading, gifError, pickGif } = gifPicker;

  const thisDraftId = computeDraftId(replyTo, quotedEvent);
  const draft = getDraft(thisDraftId);

  const restoredRef = useRef(false);
  // Restore draft content into editor when draft becomes available
  useEffect(() => {
    if (!draft || restoredRef.current) return;
    restoredRef.current = true;
    if (draft.isThread) {
      if (draft.posts?.length) {
        setThreadMode(true);
        setThreadPosts(draft.posts.map(p => ({ id: makeThreadPost().id, content: p.content || "", media: p.media || [], emojiTags: p.emojiTags || [] })));
      }
      return;
    }
    if (draft.content && editorRef.current) {
      editorRef.current.textContent = draft.content;
      setHasText(true);
    }
    if (draft.media?.length) setMedia(draft.media);
    if (draft.emojiTags?.length) setEmojiTags(draft.emojiTags);
    if (draft.excludedMentions?.length) setExcludedMentions(new Set(draft.excludedMentions));
    if (draft.selectedCircleId) {
      const c = circles.find(c => c.id === draft.selectedCircleId);
      if (c) setSelectedCircle(c);
    }
  }, [draft, circles]);

  const isNip22Reply  = replyTo?.kind === 1068 || replyTo?.kind === 6969 || replyTo?.kind === 1111 || replyTo?.kind === 30023;
  const isVoiceReply  = replyTo?.kind === 1222 || replyTo?.kind === 1244;
  const mentionedPubkeys = (replyTo && !isNip22Reply)
    ? [...new Set(replyTagsForPublish(replyTo, events).filter(t => t[0] === "p").map(t => t[1]))]
    : [];
  const quotedMentionPubkeys = quotedEvent
    ? [...new Set([quotedEvent.pubkey, ...(quotedEvent.tags || []).filter(t => t[0] === "p" && t[1]).map(t => t[1])])]
    : [];

  const allTaggedPubkeys = mentionedPubkeys.length ? mentionedPubkeys : quotedMentionPubkeys;

  const toggleMention = pk => {
    setExcludedMentions(prev => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk); else next.add(pk);
      return next;
    });
  };

  const lockedAuthorPk = replyTo ? replyTo.pubkey : quotedEvent ? quotedEvent.pubkey : null;



  const toggleAllTags = () => {
    const nonLocked = allTaggedPubkeys.filter(pk => pk !== lockedAuthorPk);
    const allIncluded = nonLocked.every(pk => !excludedMentions.has(pk));
    setExcludedMentions(prev => {
      const next = new Set(prev);
      for (const pk of nonLocked) allIncluded ? next.add(pk) : next.delete(pk);
      return next;
    });
  };

  const allNonLockedIncluded = allTaggedPubkeys.filter(pk => pk !== lockedAuthorPk).every(pk => !excludedMentions.has(pk));

  const collectDraftState = useCallback(() => (
    threadMode
      ? { isThread: true, posts: threadPosts }
      : {
          content: getContent(),
          media,
          emojiTags,
          excludedMentions,
          selectedCircleId: selectedCircle?.id ?? null,
        }
  ), [threadMode, threadPosts, media, emojiTags, excludedMentions, selectedCircle]);

  const handleDismiss = useCallback(() => {
    // Force keyboard to dismiss before closing (prevents iOS dead-zone after emoji search)
    document.activeElement?.blur();
    const hasDraftContent = threadMode
      ? threadPosts.some(p => p.content.trim() || p.media.length > 0)
      : getContent().trim().length > 0 || media.length > 0;
    if (hasDraftContent) saveDraft(thisDraftId, collectDraftState());
    onDismiss?.();
  }, [saveDraft, onDismiss, thisDraftId, collectDraftState, media, threadMode, threadPosts]);

  const isVoiceActive = voiceMode || (isVoiceReply && activeTab === "voice");
  const title   = quotedEvent ? "Quote repost" : replyTo ? "Reply" : goalMode ? "New Goal" : pollMode ? "New Poll" : threadMode ? "New Thread" : voiceMode ? "Voice note" : "New note";
  const pollValid = pollMode && pollOptions.filter(o => o.trim()).length >= 2;
  const goalValid = goalMode && goalTitle.trim().length > 0 && Number(goalAmount) > 0;
  const threadValid = threadMode && threadPosts.some(p => p.content.trim() || p.media.length > 0);
  const canPost = goalMode ? goalValid : pollMode ? pollValid : threadMode ? threadValid : (hasText || media.length > 0);

  const getContent = richText.getContent;

  const handlePost = async () => {
    if (!canPost || publishingRef.current) return;
    publishingRef.current = true;
    setPublishing(true);

    if (pollMode && publishEvent) {
      const question = getContent().trim();
      const filledOptions = pollOptions.filter(o => o.trim());
      const isZap = pollType === "zap";
      const tags = [];

      if (isZap) {
        filledOptions.forEach((label, i) => tags.push(["poll_option", String(i), label]));
        if (zapMin) tags.push(["value_minimum", String(Number(zapMin))]);
        if (zapMax) tags.push(["value_maximum", String(Number(zapMax))]);
        if (pollExpiry) tags.push(["closed_at", String(Math.floor(new Date(pollExpiry).getTime() / 1000))]);
      } else {
        filledOptions.forEach((label, i) => tags.push(["option", String(i), label]));
        tags.push(["polltype", pollChoice]);
        if (pollExpiry) tags.push(["endsAt", String(Math.floor(new Date(pollExpiry).getTime() / 1000))]);
      }

      const published = await publishEvent({ kind: isZap ? 6969 : 1068, content: question, tags }, { trackStatus: true });
      if (published) onPrepend?.(published);
      deleteDraft(thisDraftId);
      onDismiss?.();
      return;
    }

    if (goalMode && publishEvent) {
      const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
      const tags = [
        ["amount", String(Math.round(Number(goalAmount) * 1000))],
        ["relays", ...relayUrls],
      ];
      if (goalDescription.trim()) tags.push(["summary", goalDescription.trim()]);
      if (goalClosedAt) tags.push(["closed_at", String(Math.floor(new Date(goalClosedAt).getTime() / 1000))]);
      if (goalImage.trim()) tags.push(["image", goalImage.trim()]);
      const published = await publishEvent({ kind: 9041, content: goalTitle.trim(), tags }, { trackStatus: true });
      if (!published) { setUploadErr("Failed to publish — please try again."); publishingRef.current = false; setPublishing(false); return; }
      onPrepend?.(published);
      deleteDraft(thisDraftId);
      onDismiss?.();
      return;
    }

    if (threadMode && publishEvent) {
      const remaining = threadPosts
        .slice(threadPublishedCount)
        .map(p => ({ ...p, content: p.content.trim() }))
        .filter(p => p.content || p.media.length > 0);

      if (threadPublishedCount === 0 && !remaining.length) {
        publishingRef.current = false; setPublishing(false);
        return;
      }

      let prevPublished = threadPublishedCount > 0 ? threadLastPublishedRef.current : null;
      let sentCount = threadPublishedCount;
      for (const post of remaining) {
        const urls = post.media.map(m => m.url).join("\n");
        const content = [post.content, urls].filter(Boolean).join("\n");
        const tags = prevPublished ? replyTagsForPublish(prevPublished, []) : [];
        const existingPubkeys = new Set(tags.filter(pt => pt[0] === "p").map(pt => pt[1]));
        for (const t of extractContentTags(content, { existingPubkeys })) tags.push(t);
        for (const et of post.emojiTags) tags.push(et);

        const published = await publishEvent({ kind: 1, content, tags }, { trackStatus: true });
        if (!published) {
          setUploadErr(`Failed to publish post ${sentCount + 1} of ${threadPosts.length} — thread stopped. Already-posted segments are live; press Publish again to retry the rest.`);
          setThreadPublishedCount(sentCount);
          threadLastPublishedRef.current = prevPublished;
          publishingRef.current = false; setPublishing(false);
          return;
        }
        onPrepend?.(published);
        prevPublished = published;
        sentCount += 1;
      }
      deleteDraft(thisDraftId);
      onDismiss?.();
      return;
    }

    const content = getContent().trim();
    const urls = media.map(m => m.url).join("\n");
    const full = [content, urls].filter(Boolean).join("\n");
    if (publishEvent) {
      const tags = [];
      if (replyTo) {
        if (isNip22Reply) {
          for (const t of kind1111TagsForPublish(replyTo, events)) tags.push(t);
        } else {
          for (const t of replyTagsForPublish(replyTo, events)) {
            if (t[0] === "p" && excludedMentions.has(t[1])) continue;
            tags.push(t);
          }
        }
      }
      let finalContent = full;
      if (quotedEvent) {
        tags.push(["q", quotedEvent.id]);
        tags.push(["e", quotedEvent.id, "", "mention"]);
        for (const pk of quotedMentionPubkeys) {
          if (!excludedMentions.has(pk)) tags.push(["p", pk, "", "mention"]);
        }
        const noteUri = `nostr:${nip19.noteEncode(quotedEvent.id)}`;
        finalContent = finalContent ? `${finalContent}\n${noteUri}` : noteUri;
      }
      if (!isNip22Reply && selectedCircle) {
        for (const pk of selectedCircle.members) {
          tags.push(["p", pk]);
        }
      }
      const existingPubkeys = new Set(tags.filter(t => t[0] === "p").map(t => t[1]));
      for (const t of extractContentTags(finalContent, { existingPubkeys, excludedMentions })) tags.push(t);
      for (const et of emojiTags) tags.push(et);
      if (replyTo && replyTo.pubkey !== myPubkey) broadcastEvent(replyTo);
      const published = await publishEvent({ kind: isNip22Reply ? 1111 : 1, content: finalContent, tags }, { trackStatus: true });
      if (published) { onPrepend?.(published); deleteDraft(thisDraftId); }
    } else {
      onPost?.(full);
    }
    onDismiss?.();
  };

  const uploadFiles = async files => {
    if (!files.length) return;
    setUploading(true); setUploadErr("");
    const errors = [];
    for (const file of files) {
      try {
        const url = await uploadFile(file, { blossomServers, myPubkey });
        setMedia(m => [...m, { url, type: file.type.startsWith("video/") ? "video" : "image" }]);
      } catch (err) {
        errors.push(err.message);
      }
    }
    if (errors.length) setUploadErr(`Upload failed — ${errors[0]}`);
    setUploading(false);
  };

  const handleFileChange = async e => {
    const files = Array.from(e.target.files || []);
    await uploadFiles(files);
    e.target.value = "";
  };

  const selectMention = richText.selectMention;

  const handleKeyDown = e => {
    if (richText.handleMentionKeyDown(e)) return;
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canPost && !publishing) { e.preventDefault(); handlePost(); }
  };

  const insertEmoji = picked => {
    richText.insertEmoji(picked, emojiTag => {
      setEmojiTags(prev => prev.some(t => t[1] === emojiTag[1]) ? prev : [...prev, emojiTag]);
    });
  };

  return createPortal(
    <Overlay onDismiss={handleDismiss} compose>
      <div className="compose-sheet" onClick={e => e.stopPropagation()}>
        <div className="compose-sheet-bar">
          <button className="compose-sheet-cancel" onClick={handleDismiss}>Cancel</button>
          <span className="compose-sheet-title">{title}</span>
          <button
            className="compose-sheet-post"
            disabled={isVoiceActive ? voicePhase !== "preview" : !canPost || publishing}
            onClick={isVoiceActive ? () => voiceSendRef.current?.() : handlePost}
          >
            {isVoiceActive
              ? (voicePhase === "uploading" ? "Publishing…" : "Send")
              : (publishing ? "Publishing…" : "Publish")}
          </button>
        </div>

        {isVoiceReply && (
          <div className="compose-tabs">
            <button
              className={`compose-tab${activeTab === "voice" ? " active" : ""}`}
              onClick={() => setActiveTab("voice")}
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 5 }}>
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Voice
            </button>
            <button
              className={`compose-tab${activeTab === "text" ? " active" : ""}`}
              onClick={() => setActiveTab("text")}
            >
              Text
            </button>
          </div>
        )}

        {replyTo && (
          <div className="compose-sheet-context">
            <div className="compose-sheet-context-label">Replying to</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Avatar pk={replyTo.pubkey} profiles={profiles} size={24} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>{displayName(replyTo.pubkey, profiles)}</span>
                {isVoiceReply
                  ? <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "var(--text-faint)", margin: "2px 0 0", lineHeight: 1.4 }}>🎙 Voice message</p>
                  : <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                      {replyTo.content}
                    </p>
                }
              </div>
            </div>
            {!isVoiceReply && mentionedPubkeys.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span className="compose-sheet-context-label" style={{ margin: 0 }}>Tagging</span>
                <TaggingLink pubkeys={mentionedPubkeys} excludedMentions={excludedMentions} profiles={profiles} onClick={() => setShowTagList(true)} />
              </div>
            )}
          </div>
        )}

        {(voiceMode || (isVoiceReply && activeTab === "voice")) && (
          <VoiceRecorderBody
            replyTo={voiceMode ? null : replyTo} myPubkey={myPubkey}
            publishEvent={publishEvent} onPrepend={onPrepend}
            onDismiss={voiceMode ? () => setVoiceMode(false) : handleDismiss}
            blossomServers={blossomServers}
            onPhaseChange={setVoicePhase}
            onSendReady={fn => { voiceSendRef.current = fn; }}
          />
        )}

        {/* Scrollable area: text editor + image previews + quoted event scroll together */}
        {!voiceMode && (!isVoiceReply || activeTab === "text") && <div className="compose-sheet-scroll">
          {!goalMode && !threadMode && <div className="compose-sheet-body">
            <div className="compose-sheet-av">
              {myProfile?.picture
                ? <img src={myProfile.picture} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                : avatarInitial(myPubkey, { [myPubkey]: myProfile })}
            </div>
            <div
              ref={editorRef}
              className={`compose-sheet-input compose-richtext${richText.isDragOver ? " drag-over" : ""}`}
              contentEditable
              suppressContentEditableWarning
              onInput={richText.handleInput}
              onKeyDown={handleKeyDown}
              onPaste={richText.handlePaste}
              onDragOver={richText.handleDragOver}
              onDragLeave={richText.handleDragLeave}
              onDrop={richText.handleDrop}
              data-placeholder={replyTo ? "Write your reply…" : "What's on your mind?"}
            />
          </div>}

          {threadMode && (
            <ThreadCompose
              posts={threadPosts}
              onChangePosts={setThreadPosts}
              publishedCount={threadPublishedCount}
              myPubkey={myPubkey}
              myProfile={myProfile}
              profiles={profiles}
              customEmojis={customEmojis}
              blossomServers={blossomServers}
            />
          )}

          {!threadMode && selectedCircle && (
            <div style={{ padding: "0 16px 8px", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                <circle cx="19" cy="8" r="2.5" />
                <path d="M21.5 14c1.5.7 2.5 2 2.5 3.5" />
              </svg>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--primary)", fontWeight: 500 }}>
                Notifying {selectedCircle.title} ({selectedCircle.members.length})
              </span>
              <button
                type="button"
                onClick={() => setSelectedCircle(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14, lineHeight: 1, padding: 0 }}
              >✕</button>
            </div>
          )}

          {media.length > 0 && (
            <div className="compose-previews">
              {media.map((m, i) => (
                <div key={i} className="compose-preview">
                  {m.type === "video"
                    ? <video src={m.url} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <img src={m.url} alt="" />}
                  <button className="compose-preview-remove" onClick={() => setMedia(ms => ms.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
          )}

          {quotedEvent && (
            <div style={{ padding: "0 16px 12px" }}>
              {quotedMentionPubkeys.length > 0 && (
                <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="compose-sheet-context-label" style={{ margin: 0 }}>Tagging</span>
                  <TaggingLink pubkeys={quotedMentionPubkeys} excludedMentions={excludedMentions} profiles={profiles} onClick={() => setShowTagList(true)} />
                </div>
              )}
              <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px", background: "var(--surface)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <Avatar pk={quotedEvent.pubkey} profiles={profiles} size={20} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{displayName(quotedEvent.pubkey, profiles)}</span>
                </div>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {quotedEvent.content}
                </p>
              </div>
            </div>
          )}
        </div>}

        {!voiceMode && (!isVoiceReply || activeTab === "text") && <>
        {pollMode && (
          <PollCompose
            pollType={pollType}
            onChangePollType={t => { setPollType(t); }}
            options={pollOptions}
            onChangeOptions={setPollOptions}
            pollChoice={pollChoice}
            onChangePollChoice={setPollChoice}
            expiry={pollExpiry}
            onChangeExpiry={setPollExpiry}
            zapMin={zapMin}
            onChangeZapMin={setZapMin}
            zapMax={zapMax}
            onChangeZapMax={setZapMax}
          />
        )}

        {goalMode && (
          <GoalCompose
            title={goalTitle}
            onChangeTitle={setGoalTitle}
            description={goalDescription}
            onChangeDescription={setGoalDescription}
            amount={goalAmount}
            onChangeAmount={setGoalAmount}
            closedAt={goalClosedAt}
            onChangeClosedAt={setGoalClosedAt}
            image={goalImage}
            onChangeImage={setGoalImage}
          />
        )}

        {uploadErr  && <div className="compose-upload-status" style={{ color: "#E05C8A" }}>{uploadErr}</div>}
        {uploading   && <div className="compose-upload-status">Uploading…</div>}

        {showEmoji && (
          <EmojiPicker customEmojis={customEmojis} height={280} onSelect={emoji => { insertEmoji(emoji); setShowEmoji(false); }} />
        )}

        {showTagList && (
          <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Tagging</span>
                {allTaggedPubkeys.filter(pk => pk !== lockedAuthorPk).length > 0 && (
                  <button type="button" onClick={toggleAllTags} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "var(--primary)", padding: "2px 4px" }}>
                    {allNonLockedIncluded ? "Remove all" : "Add all"}
                  </button>
                )}
              </div>
              <button type="button" onClick={() => setShowTagList(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16, lineHeight: 1, padding: 4 }}>✕</button>
            </div>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {allTaggedPubkeys.map(pk => {
                const included = !excludedMentions.has(pk);
                const isLocked = pk === lockedAuthorPk;
                return (
                  <button
                    key={pk}
                    type="button"
                    onClick={() => !isLocked && toggleMention(pk)}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 16px", background: "none", border: "none", cursor: isLocked ? "default" : "pointer", textAlign: "left" }}
                  >
                    <Avatar pk={pk} profiles={profiles} size={30} />
                    <span style={{ flex: 1, fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: included ? "var(--text)" : "var(--text-faint)", textDecoration: included ? "none" : "line-through" }}>
                      {displayName(pk, profiles)}
                      {isLocked && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--text-faint)", marginLeft: 6 }}>author</span>}
                    </span>
                    <span style={{ width: 20, textAlign: "center", color: isLocked ? "var(--text-faint)" : "var(--primary)", fontSize: 16 }}>
                      {included ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showGif && (
          <div className="gif-picker">
            <div className="gif-search-row">
              <input className="gif-search-input" placeholder="Search GIFs…" value={gifQuery} onChange={e => setGifQuery(e.target.value)} autoFocus />
              <button type="button" className="compose-media-btn" onClick={() => setShowGif(false)}>✕</button>
            </div>
            {gifLoading
              ? <div style={{ padding: "20px", textAlign: "center", fontSize: 12, color: "var(--text-faint)" }}>Loading…</div>
              : gifError
                ? <div style={{ padding: "20px", textAlign: "center", fontSize: 12, color: "var(--text-faint)" }}>{gifError}</div>
                : <div className="gif-grid">
                    {gifs.map((g, i) => {
                      const thumb = g.images?.fixed_height_small?.url || g.images?.fixed_height?.url;
                      return (
                        <div key={i} className="gif-item" onClick={() => pickGif(g)}>
                          {thumb && <img src={thumb} alt="" loading="lazy" />}
                        </div>
                      );
                    })}
                  </div>
            }
          </div>
        )}

        {showCirclePicker && circles.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg)", padding: "8px 0" }}>
            {circles.map(circle => (
              <button
                key={circle.id}
                type="button"
                onClick={() => {
                  setSelectedCircle(selectedCircle?.id === circle.id ? null : circle);
                  setShowCirclePicker(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 16px",
                  background: selectedCircle?.id === circle.id ? "var(--surface)" : "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "var(--text)",
                }}
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={selectedCircle?.id === circle.id ? "var(--primary)" : "currentColor"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="3" />
                  <path d="M3 18c0-3 2.7-5 6-5s6 2 6 5" />
                  <circle cx="18" cy="7" r="2" />
                  <path d="M20 14c1.2.6 2 1.7 2 3" />
                </svg>
                <span style={{ flex: 1, fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: selectedCircle?.id === circle.id ? 600 : 400 }}>
                  {circle.title}
                </span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--text-muted)" }}>
                  {circle.members.length}
                </span>
              </button>
            ))}
          </div>
        )}

        {!threadMode && richText.mentionResults.length > 0 && (
          <div className="mention-list">
            {richText.mentionResults.map((pk, i) => (
              <button
                key={pk}
                type="button"
                className={`mention-item${i === richText.mentionIndex ? " active" : ""}`}
                onMouseDown={e => { e.preventDefault(); selectMention(pk); }}
                onMouseEnter={() => richText.setMentionIndex(i)}
              >
                <Avatar pk={pk} profiles={profiles} size={28} />
                <div className="mention-item-info">
                  <span className="mention-item-name">{displayName(pk, profiles)}</span>
                  {profiles[pk]?.nip05 && <span className="mention-item-nip05">{profiles[pk].nip05}</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="compose-sheet-footer">
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={handleFileChange} />
          {!threadMode && <button className="compose-media-btn" title="Add image or video" onClick={() => fileRef.current?.click()}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
          </button>}
          {!threadMode && <button
            type="button"
            className="compose-media-btn compose-emoji-toggle"
            title="Emoji"
            onClick={() => { setShowGif(false); setShowEmoji(v => !v); }}
            style={{
              ...(showEmoji ? { color: "var(--primary)", background: "var(--surface)" } : {}),
              ...(customEmojis.length > 0 ? { display: "inline-flex" } : {}),
            }}
            aria-label="Insert emoji"
            aria-pressed={showEmoji}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>}
          {!threadMode && <button type="button" className="compose-media-btn" title="Add GIF" onClick={() => { setShowEmoji(false); setShowGif(v => !v); }}
            style={showGif ? { color: "var(--primary)", background: "var(--surface)" } : {}}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", letterSpacing: "-.5px" }}>GIF</span>
          </button>}
          {!replyTo && !quotedEvent && (
            <button
              type="button"
              className="compose-media-btn"
              title="Voice note"
              onClick={() => { setShowEmoji(false); setShowGif(false); setPollMode(false); setGoalMode(false); setThreadMode(false); setVoiceMode(v => !v); }}
              style={voiceMode ? { color: "var(--primary)", background: "var(--surface)" } : {}}
              aria-pressed={voiceMode}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {!replyTo && !quotedEvent && (
            <button
              type="button"
              className="compose-media-btn"
              title="Create poll"
              onClick={() => { setShowEmoji(false); setShowGif(false); setGoalMode(false); setThreadMode(false); setPollMode(v => !v); }}
              style={pollMode ? { color: "var(--primary)", background: "var(--surface)" } : {}}
              aria-pressed={pollMode}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </button>
          )}
          {!replyTo && !quotedEvent && (
            <button
              type="button"
              className="compose-media-btn"
              title="Create goal"
              onClick={() => { setShowEmoji(false); setShowGif(false); setPollMode(false); setThreadMode(false); setGoalMode(v => !v); }}
              style={goalMode ? { color: "var(--primary)", background: "var(--surface)" } : {}}
              aria-pressed={goalMode}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </button>
          )}
          {!replyTo && !quotedEvent && (
            <button
              type="button"
              className="compose-media-btn"
              title="Start a thread"
              onClick={() => { setShowEmoji(false); setShowGif(false); setPollMode(false); setGoalMode(false); setThreadMode(v => !v); }}
              style={threadMode ? { color: "var(--primary)", background: "var(--surface)" } : {}}
              aria-pressed={threadMode}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="2.5" />
                <circle cx="6" cy="18" r="2.5" />
                <path d="M6 8.5v7" />
                <path d="M9.5 6H16a3 3 0 0 1 3 3v0" />
                <path d="M9.5 18H16a3 3 0 0 0 3-3v0" />
                <polyline points="16.5 6.5 19 9 16.5 11.5" />
                <polyline points="16.5 17.5 19 15 16.5 12.5" />
              </svg>
            </button>
          )}
          {!replyTo && !quotedEvent && circles.length > 0 && (
            <button
              type="button"
              className="compose-media-btn"
              title="Post to a circle"
              onClick={() => { setShowEmoji(false); setShowGif(false); setShowCirclePicker(v => !v); }}
              style={selectedCircle || showCirclePicker ? { color: "var(--primary)", background: "var(--surface)" } : {}}
              aria-pressed={showCirclePicker}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="3" />
                <path d="M3 18c0-3 2.7-5 6-5s6 2 6 5" />
                <circle cx="18" cy="7" r="2" />
                <path d="M20 14c1.2.6 2 1.7 2 3" />
              </svg>
            </button>
          )}
        </div>
        </>}
      </div>
    </Overlay>,
    sheetPortal()
  );
}
