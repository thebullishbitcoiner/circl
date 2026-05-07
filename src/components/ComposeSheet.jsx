import { useState, useEffect, useRef } from "react";
import Overlay from "./Overlay.jsx";
import Avatar from "./Avatar.jsx";
import { displayName, avatarInitial, replyTagsForPublish } from "../utils.js";
import { TENOR_KEY, COMPOSE_EMOJIS } from "../constants.js";

export default function ComposeSheet({ replyTo, quotedEvent, profiles, myPubkey, myProfile, onPost, onDismiss, publishEvent, onPrepend, events = [] }) {
  const [text,        setText]        = useState("");
  const [media,       setMedia]       = useState([]);
  const [uploading,   setUploading]   = useState(false);
  const [uploadErr,   setUploadErr]   = useState("");
  const [showGif,     setShowGif]     = useState(false);
  const [gifQuery,    setGifQuery]    = useState("");
  const [gifs,        setGifs]        = useState([]);
  const [gifLoading,  setGifLoading]  = useState(false);
  const [showEmoji,   setShowEmoji]   = useState(false);
  const fileRef       = useRef(null);
  const textareaRef   = useRef(null);

  const title   = quotedEvent ? "Quote repost" : replyTo ? "Reply" : "New note";
  const canPost = text.trim() || media.length > 0;

  const handlePost = async () => {
    if (!canPost) return;
    const urls = media.map(m => m.url).join("\n");
    const full = [text.trim(), urls].filter(Boolean).join("\n");
    if (publishEvent) {
      const tags = [];
      if (replyTo) {
        for (const t of replyTagsForPublish(replyTo, events)) tags.push(t);
      }
      if (quotedEvent)  { tags.push(["q", quotedEvent.id]); tags.push(["e", quotedEvent.id, "", "mention"]); tags.push(["p", quotedEvent.pubkey, "", "mention"]); }
      const published = await publishEvent({ kind: 1, content: full, tags });
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
      const form = new FormData();
      form.append("fileToUpload", file);
      const res  = await fetch("https://nostr.build/api/v1/upload", { method: "POST", body: form });
      const json = await res.json();
      const url  = json?.data?.[0]?.url;
      if (!url) throw new Error("No URL returned");
      setMedia(m => [...m, { url, type: "image" }]);
    } catch { setUploadErr("Upload failed — try again"); }
    finally  { setUploading(false); e.target.value = ""; }
  };

  const searchGifs = async q => {
    if (!q.trim()) { setGifs([]); return; }
    setGifLoading(true);
    try {
      const res  = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=18&media_filter=gif`);
      const json = await res.json();
      setGifs(json.results || []);
    } catch {}
    setGifLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => searchGifs(gifQuery), 400);
    return () => clearTimeout(t);
  }, [gifQuery]);

  useEffect(() => {
    if (!showGif || gifQuery) return;
    (async () => {
      setGifLoading(true);
      try {
        const res  = await fetch(`https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&limit=18&media_filter=gif`);
        const json = await res.json();
        setGifs(json.results || []);
      } catch {}
      setGifLoading(false);
    })();
  }, [showGif]);

  const pickGif = gif => {
    const url = gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url;
    if (!url) return;
    setMedia(m => [...m, { url, type: "gif" }]);
    setShowGif(false); setGifQuery("");
  };

  const insertEmoji = emoji => {
    const ta = textareaRef.current;
    const apply = (before, after, caret) => {
      const next = (before + emoji + after).slice(0, 280);
      setText(next);
      requestAnimationFrame(() => {
        if (ta) {
          ta.focus();
          const pos = Math.min(caret + emoji.length, next.length);
          ta.setSelectionRange(pos, pos);
        }
      });
    };
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      apply(text.slice(0, start), text.slice(end), start);
    } else {
      setText(t => (t + emoji).slice(0, 280));
    }
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
          <textarea
            ref={textareaRef}
            className="compose-sheet-input"
            placeholder={replyTo ? "Write your reply…" : "What's on your mind?"}
            value={text}
            onChange={e => setText(e.target.value.slice(0, 280))}
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
          <div className="compose-emoji-picker">
            <div className="gif-search-row">
              <span className="compose-emoji-picker-label">Emoji</span>
              <button type="button" className="compose-media-btn" onClick={() => setShowEmoji(false)} aria-label="Close emoji picker">✕</button>
            </div>
            <div className="emoji-grid compose-emoji-grid">
              {COMPOSE_EMOJIS.map(emoji => (
                <button key={emoji} type="button" className="emoji-btn" onClick={() => insertEmoji(emoji)}>
                  {emoji}
                </button>
              ))}
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
              : <div className="gif-grid">
                  {gifs.map((g, i) => {
                    const thumb = g.media_formats?.tinygif?.url || g.media_formats?.gif?.url;
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

        <div className="compose-sheet-footer">
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
          <button className="compose-media-btn" title="Add image" onClick={() => fileRef.current?.click()}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <button
            type="button"
            className="compose-media-btn"
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
          <span className={`compose-char-count${text.length > 240 ? " warn" : ""}`}>
            {text.length > 0 ? `${280 - text.length}` : ""}
          </span>
        </div>
      </div>
    </Overlay>
  );
}
