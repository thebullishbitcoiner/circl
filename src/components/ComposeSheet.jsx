import { useState, useEffect, useRef } from "react";
import Overlay from "./Overlay.jsx";
import Avatar from "./Avatar.jsx";
import { displayName, avatarInitial, replyTagsForPublish, nip19 } from "../utils.js";
import { GIPHY_KEY } from "../constants.js";
import EmojiPicker from "./EmojiPicker.jsx";

export default function ComposeSheet({ replyTo, quotedEvent, profiles, myPubkey, myProfile, onPost, onDismiss, publishEvent, onPrepend, events = [] }) {
  const [hasText,        setHasText]        = useState(false);
  const [media,          setMedia]          = useState([]);
  const [uploading,      setUploading]      = useState(false);
  const [uploadErr,      setUploadErr]      = useState("");
  const [showGif,        setShowGif]        = useState(false);
  const [gifQuery,       setGifQuery]       = useState("");
  const [gifs,           setGifs]           = useState([]);
  const [gifLoading,     setGifLoading]     = useState(false);
  const [gifError,       setGifError]       = useState("");
  const [showEmoji,      setShowEmoji]      = useState(false);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionIndex,   setMentionIndex]   = useState(0);
  const fileRef   = useRef(null);
  const editorRef = useRef(null);

  const title   = quotedEvent ? "Quote repost" : replyTo ? "Reply" : "New note";
  const canPost = hasText || media.length > 0;

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
    if (!canPost) return;
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
      const published = await publishEvent({ kind: 1, content: finalContent, tags });
      if (published) onPrepend?.(published);
    } else {
      onPost?.(full);
    }
    onDismiss?.();
  };

  const handleFileChange = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadErr("");
    try {
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
      setMedia(m => [...m, { url, type: "image" }]);
    } catch (err) { setUploadErr(`Upload failed — ${err.message}`); }
    finally  { setUploading(false); e.target.value = ""; }
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
          <button className="compose-sheet-post" disabled={!canPost} onClick={handlePost}>Publish</button>
        </div>

        {replyTo && (
          <div className="compose-sheet-context">
            <div className="compose-sheet-context-label">Replying to</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Avatar pk={replyTo.pubkey} profiles={profiles} size={24} />
              <div>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>{displayName(replyTo.pubkey, profiles)}</span>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {replyTo.content}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="compose-sheet-body">
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
        </div>

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

        {quotedEvent && (
          <div style={{ padding: "0 16px 12px", flexShrink: 0 }}>
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
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
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
        </div>
      </div>
    </Overlay>
  );
}
