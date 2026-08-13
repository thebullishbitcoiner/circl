import { useState, useEffect, useRef } from "react";
import Avatar from "./Avatar.jsx";
import EmojiPicker from "./EmojiPicker.jsx";
import { replyTagsForPublish, kind1111TagsForPublish, videoPosterUrl, imetaTagForMedia } from "../utils.js";
import { GIPHY_KEY } from "../constants.js";
import { uploadFileWithMeta } from "../utils/upload.js";

const isAddressableKind = k => k >= 30000 && k <= 39999;

export default function InlineCompose({
  replyTo, myPubkey, myProfile, profiles, events = [],
  publishEvent, onSuccess,
  blossomServers = [], customEmojis = [],
}) {
  const [text, setText] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [media, setMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [emojiTags, setEmojiTags] = useState([]);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);

  const canPost = text.trim().length > 0 || media.length > 0;

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  function insertAtCursor(ins) {
    const el = textareaRef.current;
    if (!el) { setText(t => t + ins); return; }
    const s = el.selectionStart, e = el.selectionEnd;
    const newText = text.slice(0, s) + ins + text.slice(e);
    setText(newText);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = s + ins.length;
      el.focus();
      autoResize();
    });
  }

  function insertEmoji(picked) {
    const isCustom = picked && typeof picked === "object";
    insertAtCursor(isCustom ? picked.content : picked);
    if (isCustom && picked.emojiTag) {
      setEmojiTags(prev => prev.some(t => t[1] === picked.emojiTag[1]) ? prev : [...prev, picked.emojiTag]);
    }
  }

  const fetchGifs = async url => {
    setGifLoading(true);
    try {
      const res = await fetch(url);
      const json = await res.json();
      setGifs(json.data || []);
    } catch {}
    setGifLoading(false);
  };

  useEffect(() => {
    if (!showGif) { setGifs([]); setGifQuery(""); return; }
    if (!gifQuery.trim()) {
      fetchGifs(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=18&rating=g`);
      return;
    }
    const t = setTimeout(() => fetchGifs(
      `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(gifQuery)}&limit=18&rating=g`
    ), 400);
    return () => clearTimeout(t);
  }, [showGif, gifQuery]);

  const pickGif = gif => {
    const url = gif.images?.original?.url || gif.images?.downsized?.url;
    if (!url) return;
    setMedia(m => [...m, { url, type: "gif" }]);
    setShowGif(false);
  };

  const handleFileChange = async e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      try {
        const uploaded = await uploadFileWithMeta(file, { blossomServers, myPubkey });
        setMedia(m => [...m, { ...uploaded, type: file.type.startsWith("video/") ? "video" : "image" }]);
      } catch {}
    }
    setUploading(false);
    e.target.value = "";
  };

  async function handlePost() {
    if (!canPost || publishing || !publishEvent) return;
    setPublishing(true);
    try {
      const useNip22 = isAddressableKind(replyTo.kind) || replyTo.kind === 1111;
      const tags = useNip22 ? kind1111TagsForPublish(replyTo, events) : replyTagsForPublish(replyTo, events);
      const kind = useNip22 ? 1111 : 1;
      const urls = media.map(m => m.url).join("\n");
      const fullContent = [text.trim(), urls].filter(Boolean).join("\n");
      for (const et of emojiTags) tags.push(et);
      for (const m of media) { const t = imetaTagForMedia(m); if (t) tags.push(t); }
      const published = await publishEvent({ kind, content: fullContent, tags });
      if (published) {
        setText(""); setMedia([]); setEmojiTags([]);
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        onSuccess?.(published);
      }
    } catch {}
    setPublishing(false);
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canPost && !publishing) {
      e.preventDefault();
      handlePost();
    }
  }

  return (
    <div className="cal-inline-compose">
      <Avatar pk={myPubkey} profiles={profiles} size={32} />
      <div className="cal-inline-compose-right">
        <textarea
          ref={textareaRef}
          className="cal-inline-compose-input"
          placeholder="Write a comment…"
          value={text}
          onChange={e => { setText(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        {media.length > 0 && (
          <div className="cal-inline-media-strip">
            {media.map((m, i) => (
              <div key={i} className="cal-inline-media-thumb">
                {m.type === "video"
                  ? <video src={m.url} poster={videoPosterUrl(m.url)} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <img src={m.url} alt="" />}
                <button type="button" className="cal-inline-media-remove" onClick={() => setMedia(prev => prev.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
        )}

        {showEmoji && (
          <div className="cal-inline-emoji-wrap">
            <EmojiPicker customEmojis={customEmojis} height={280} onSelect={e => { insertEmoji(e); setShowEmoji(false); }} />
          </div>
        )}

        {showGif && (
          <div className="cal-inline-gif-picker">
            <div className="cal-inline-gif-search">
              <input
                className="cal-inline-gif-input"
                placeholder="Search GIFs…"
                value={gifQuery}
                onChange={e => setGifQuery(e.target.value)}
                autoFocus
              />
            </div>
            {gifLoading
              ? <div className="cal-inline-gif-status">Loading…</div>
              : (
                <div className="gif-grid">
                  {gifs.map((g, i) => {
                    const thumb = g.images?.fixed_height_small?.url || g.images?.fixed_height?.url;
                    return (
                      <div key={i} className="gif-item" onClick={() => pickGif(g)}>
                        {thumb && <img src={thumb} alt="" loading="lazy" />}
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>
        )}

        <div className="cal-inline-compose-footer">
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={handleFileChange} />
          <div className="cal-inline-toolbar">
            <button type="button" className="cal-inline-toolbar-btn" title="Add image" onClick={() => fileRef.current?.click()}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
            <button
              type="button"
              className="cal-inline-toolbar-btn"
              title="Emoji"
              onClick={() => { setShowGif(false); setShowEmoji(v => !v); }}
              style={showEmoji ? { color: "var(--primary)" } : {}}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </button>
            <button
              type="button"
              className="cal-inline-toolbar-btn"
              title="Add GIF"
              onClick={() => { setShowEmoji(false); setShowGif(v => !v); }}
              style={showGif ? { color: "var(--primary)" } : {}}
            >
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", letterSpacing: "-.3px" }}>GIF</span>
            </button>
            {uploading && <span className="cal-inline-uploading">Uploading…</span>}
          </div>
          {canPost && (
            <button type="button" className="cal-inline-compose-submit" disabled={!canPost || publishing} onClick={handlePost}>
              {publishing ? "Posting…" : "Post"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
