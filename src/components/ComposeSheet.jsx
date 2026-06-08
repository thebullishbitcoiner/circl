import { useState, useEffect, useRef } from "react";
import Overlay from "./Overlay.jsx";
import Avatar from "./Avatar.jsx";
import { displayName, avatarInitial, replyTagsForPublish, nip19 } from "../utils.js";
import { GIPHY_KEY, RELAYS } from "../constants.js";
import { broadcastEvent, pool } from "../nostr.js";
import EmojiPicker from "./EmojiPicker.jsx";
import PollCompose from "./PollCompose.jsx";
import GoalCompose from "./GoalCompose.jsx";

export default function ComposeSheet({ replyTo, quotedEvent, profiles, myPubkey, myProfile, onPost, onDismiss, publishEvent, onPrepend, events = [], circles = [], initialCircle = null }) {
  const [hasText,        setHasText]        = useState(false);
  const [media,          setMedia]          = useState([]);
  const [uploading,      setUploading]      = useState(false);
  const [uploadErr,      setUploadErr]      = useState("");
  const [publishing,     setPublishing]     = useState(false);
  const [showGif,        setShowGif]        = useState(false);
  const [gifQuery,       setGifQuery]       = useState("");
  const [gifs,           setGifs]           = useState([]);
  const [gifLoading,     setGifLoading]     = useState(false);
  const [gifError,       setGifError]       = useState("");
  const [showEmoji,      setShowEmoji]      = useState(false);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionIndex,   setMentionIndex]   = useState(0);
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
  const fileRef   = useRef(null);
  const editorRef = useRef(null);

  const title   = quotedEvent ? "Quote repost" : replyTo ? "Reply" : goalMode ? "New Goal" : pollMode ? "New Poll" : "New note";
  const pollValid = pollMode && pollOptions.filter(o => o.trim()).length >= 2;
  const goalValid = goalMode && goalTitle.trim().length > 0 && Number(goalAmount) > 0;
  const canPost = goalMode ? goalValid : pollMode ? pollValid : (hasText || media.length > 0);

  // Walk the contenteditable DOM and produce the final content string,
  // converting mention chip spans back to their nostr: URIs.
  const getContent = () => {
    const div = editorRef.current;
    if (!div) return "";
    let result = "";
    const walk = node => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.dataset?.uri) {
          result += node.dataset.uri;
        } else if (node.tagName === "BR") {
          result += "\n";
        } else {
          if (node.tagName === "DIV" && result.length > 0) result += "\n";
          node.childNodes.forEach(walk);
        }
      }
    };
    div.childNodes.forEach(walk);
    return result;
  };

  const handlePost = async () => {
    if (!canPost || publishing) return;
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

      const published = await publishEvent({ kind: isZap ? 6969 : 1068, content: question, tags });
      if (published) onPrepend?.(published);
      onDismiss?.();
      return;
    }

    if (goalMode && publishEvent) {
      const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
      const tags = [
        ["amount", String(Math.round(Number(goalAmount) * 1000))],
        ["relays", ...relayUrls],
      ];
      if (goalDescription.trim()) tags.push(["summary", goalDescription.trim()]);
      if (goalClosedAt) tags.push(["closed_at", String(Math.floor(new Date(goalClosedAt).getTime() / 1000))]);
      if (goalImage.trim()) tags.push(["image", goalImage.trim()]);
      const published = await publishEvent({ kind: 9041, content: goalTitle.trim(), tags });
      if (!published) { setUploadErr("Failed to publish — please try again."); setPublishing(false); return; }
      onPrepend?.(published);
      onDismiss?.();
      return;
    }

    const content = getContent().trim();
    const urls = media.map(m => m.url).join("\n");
    const full = [content, urls].filter(Boolean).join("\n");
    if (publishEvent) {
      const tags = [];
      if (replyTo) {
        for (const t of replyTagsForPublish(replyTo, events)) tags.push(t);
      }
      let finalContent = full;
      if (quotedEvent) {
        tags.push(["q", quotedEvent.id]);
        tags.push(["e", quotedEvent.id, "", "mention"]);
        tags.push(["p", quotedEvent.pubkey, "", "mention"]);
        const noteUri = `nostr:${nip19.noteEncode(quotedEvent.id)}`;
        finalContent = finalContent ? `${finalContent}\n${noteUri}` : noteUri;
      }
      if (selectedCircle) {
        for (const pk of selectedCircle.members) {
          tags.push(["p", pk]);
        }
      }
      const hashtags = [...new Set(
        [...finalContent.matchAll(/#([a-zA-Z][a-zA-Z0-9_]+)/g)].map(m => m[1].toLowerCase())
      )];
      for (const ht of hashtags) tags.push(["t", ht]);
      if (replyTo && replyTo.pubkey !== myPubkey) broadcastEvent(replyTo);
      const published = await publishEvent({ kind: 1, content: finalContent, tags });
      if (published) onPrepend?.(published);
    } else {
      onPost?.(full);
    }
    onDismiss?.();
  };

  const uploadFile = async file => {
    const uploadUrl = "https://nostr.build/api/v2/upload/files";
    let authHeader = "";
    if (myPubkey && window.nostr?.signEvent) {
      const buf         = await file.arrayBuffer();
      const digest      = await crypto.subtle.digest("SHA-256", buf);
      const payloadHash = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, "0")).join("");
      const authEvent = await window.nostr.signEvent({
        kind: 27235,
        pubkey: myPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["u", uploadUrl], ["method", "POST"], ["payload", payloadHash]],
        content: "",
      });
      authHeader = `Nostr ${btoa(JSON.stringify(authEvent))}`;
    }
    const form = new FormData();
    form.append("file", file);
    const headers = authHeader ? { Authorization: authHeader } : {};
    const res  = await fetch(uploadUrl, { method: "POST", headers, body: form });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }
    const json = await res.json();
    const url  = json?.nip94_event?.tags?.find(t => t[0] === "url")?.[1]
              ?? json?.data?.[0]?.url;
    if (!url) throw new Error("No URL returned");
    return url;
  };

  const handleFileChange = async e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true); setUploadErr("");
    const errors = [];
    for (const file of files) {
      try {
        const url = await uploadFile(file);
        setMedia(m => [...m, { url, type: "image" }]);
      } catch (err) {
        errors.push(err.message);
      }
    }
    if (errors.length) setUploadErr(`Upload failed — ${errors[0]}`);
    setUploading(false);
    e.target.value = "";
  };

  const fetchGifs = async url => {
    setGifLoading(true);
    setGifError("");
    try {
      const res  = await fetch(url);
      const json = await res.json();
      if (json.message) { setGifError(json.message); setGifs([]); }
      else setGifs(json.data || []);
    } catch (e) {
      setGifError("Could not load GIFs");
      setGifs([]);
    }
    setGifLoading(false);
  };

  useEffect(() => {
    if (!gifQuery.trim()) { setGifs([]); setGifError(""); return; }
    const t = setTimeout(() =>
      fetchGifs(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(gifQuery)}&limit=18&rating=g`),
      400
    );
    return () => clearTimeout(t);
  }, [gifQuery]);

  useEffect(() => {
    if (!showGif || gifQuery) return;
    fetchGifs(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=18&rating=g`);
  }, [showGif]);

  const pickGif = gif => {
    const url = gif.images?.original?.url || gif.images?.downsized?.url;
    if (!url) return;
    setMedia(m => [...m, { url, type: "gif" }]);
    setShowGif(false); setGifQuery("");
  };

  const handleInput = () => {
    setHasText(getContent().trim().length > 0);

    const sel = window.getSelection();
    if (!sel?.rangeCount) { setMentionResults([]); return; }
    const range = sel.getRangeAt(0);
    if (range.startContainer.nodeType !== Node.TEXT_NODE) { setMentionResults([]); return; }

    const textBefore = range.startContainer.textContent.slice(0, range.startOffset);
    const match = textBefore.match(/@([\w.-]*)$/);
    if (match && Object.keys(profiles || {}).length > 0) {
      const query = match[1].toLowerCase();
      setMentionIndex(0);
      const results = Object.entries(profiles)
        .filter(([pk, p]) => {
          if (pk === myPubkey) return false;
          const name = (p.display_name || p.name || "").toLowerCase();
          const nip05 = (p.nip05 || "").toLowerCase().split("@")[0];
          return !query || name.startsWith(query) || nip05.startsWith(query);
        })
        .slice(0, 6)
        .map(([pk]) => pk);
      setMentionResults(results);
    } else {
      setMentionResults([]);
    }
  };

  const selectMention = pk => {
    const div = editorRef.current;
    const name = displayName(pk, profiles);
    const uri  = `nostr:${nip19.npubEncode(pk)}`;

    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;

    const textBefore = textNode.textContent.slice(0, range.startOffset);
    const atIndex = textBefore.lastIndexOf("@");
    if (atIndex === -1) return;

    const replaceRange = document.createRange();
    replaceRange.setStart(textNode, atIndex);
    replaceRange.setEnd(textNode, range.startOffset);
    replaceRange.deleteContents();

    const chip = document.createElement("span");
    chip.className = "mention-chip";
    chip.dataset.uri = uri;
    chip.contentEditable = "false";
    chip.textContent = `@${name}`;
    replaceRange.insertNode(chip);

    const space = document.createTextNode(" ");
    chip.after(space);

    const newRange = document.createRange();
    newRange.setStart(space, space.length);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    setMentionResults([]);
    setHasText(true);
    div.focus();
  };

  const handleKeyDown = e => {
    if (mentionResults.length > 0) {
      if (e.key === "ArrowDown")                  { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionResults.length - 1)); return; }
      if (e.key === "ArrowUp")                    { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab")   { e.preventDefault(); selectMention(mentionResults[mentionIndex]); return; }
      if (e.key === "Escape")                     { setMentionResults([]); return; }
    }
  };

  const handlePaste = e => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    const newRange = document.createRange();
    newRange.setStartAfter(node);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    setHasText(getContent().trim().length > 0);
  };

  const insertEmoji = emoji => {
    const div = editorRef.current;
    if (!div) return;
    div.focus();
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(emoji);
      range.insertNode(node);
      const newRange = document.createRange();
      newRange.setStartAfter(node);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    setHasText(true);
  };

  return (
    <Overlay onDismiss={onDismiss} compose>
      <div className="compose-sheet" onClick={e => e.stopPropagation()}>
        <div className="compose-sheet-bar">
          <button className="compose-sheet-cancel" onClick={onDismiss}>Cancel</button>
          <span className="compose-sheet-title">{title}</span>
          <button className="compose-sheet-post" disabled={!canPost || publishing} onClick={handlePost}>{publishing ? "Publishing…" : "Publish"}</button>
        </div>

        {replyTo && (
          <div className="compose-sheet-context">
            <div className="compose-sheet-context-label">Replying to</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Avatar pk={replyTo.pubkey} profiles={profiles} size={24} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>{displayName(replyTo.pubkey, profiles)}</span>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  {replyTo.content}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable area: text editor + image previews + quoted event scroll together */}
        <div className="compose-sheet-scroll">
          {!goalMode && <div className="compose-sheet-body">
            <div className="compose-sheet-av">
              {myProfile?.picture
                ? <img src={myProfile.picture} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                : avatarInitial(myPubkey, { [myPubkey]: myProfile })}
            </div>
            <div
              ref={editorRef}
              className="compose-sheet-input compose-richtext"
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              data-placeholder={replyTo ? "Write your reply…" : "What's on your mind?"}
            />
          </div>}

          {selectedCircle && (
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
                  <img src={m.url} alt="" />
                  <button className="compose-preview-remove" onClick={() => setMedia(ms => ms.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
          )}

          {quotedEvent && (
            <div style={{ padding: "0 16px 12px" }}>
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
        </div>

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
          <EmojiPicker onSelect={emoji => { insertEmoji(emoji); }} />
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

        {mentionResults.length > 0 && (
          <div className="mention-list">
            {mentionResults.map((pk, i) => (
              <button
                key={pk}
                type="button"
                className={`mention-item${i === mentionIndex ? " active" : ""}`}
                onMouseDown={e => { e.preventDefault(); selectMention(pk); }}
                onMouseEnter={() => setMentionIndex(i)}
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
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFileChange} />
          <button className="compose-media-btn" title="Add image" onClick={() => fileRef.current?.click()}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <button
            type="button"
            className="compose-media-btn compose-emoji-toggle"
            title="Emoji"
            onClick={() => { setShowGif(false); setShowEmoji(v => !v); }}
            style={showEmoji ? { color: "var(--primary)", background: "var(--surface)" } : {}}
            aria-label="Insert emoji"
            aria-pressed={showEmoji}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          <button type="button" className="compose-media-btn" title="Add GIF" onClick={() => { setShowEmoji(false); setShowGif(v => !v); }}
            style={showGif ? { color: "var(--primary)", background: "var(--surface)" } : {}}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", letterSpacing: "-.5px" }}>GIF</span>
          </button>
          {!replyTo && !quotedEvent && (
            <button
              type="button"
              className="compose-media-btn"
              title="Create poll"
              onClick={() => { setShowEmoji(false); setShowGif(false); setGoalMode(false); setPollMode(v => !v); }}
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
              onClick={() => { setShowEmoji(false); setShowGif(false); setPollMode(false); setGoalMode(v => !v); }}
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
      </div>
    </Overlay>
  );
}
