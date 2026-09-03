import { useState, useEffect } from "react";
import Avatar from "./Avatar.jsx";
import { displayName } from "../utils.js";

const EMOJI_SET_KIND = 30030;
const PAGE = 60;

export function emojiSetInfo(event) {
  const dTag = event?.tags?.find(t => t[0] === "d")?.[1] ?? "";
  const title = event?.tags?.find(t => t[0] === "title")?.[1] || dTag || "Emoji set";
  const emojis = [...new Map(
    (event?.tags || [])
      .filter(t => t[0] === "emoji" && t[1] && t[2])
      .map(t => [t[1], { name: t[1], url: t[2] }])
  ).values()];
  const aTag = `${EMOJI_SET_KIND}:${event?.pubkey}:${dTag}`;
  return { dTag, title, emojis, aTag };
}

// Scrollable emoji grid — sets can be large, so cap the height and page the DOM.
export function EmojiGrid({ emojis, minCol = 56, maxHeight, pad = 0 }) {
  const [shown, setShown] = useState(Math.min(emojis.length, PAGE));
  useEffect(() => { setShown(Math.min(emojis.length, PAGE)); }, [emojis]);
  const onScroll = e => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) {
      setShown(n => Math.min(n + PAGE, emojis.length));
    }
  };
  return (
    <div
      onScroll={maxHeight ? onScroll : undefined}
      style={{
        marginTop: 6,
        ...(maxHeight ? { maxHeight, overflowY: "auto" } : {}),
        padding: pad,
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`,
        gap: 10,
      }}
    >
      {emojis.slice(0, shown).map(e => (
        <div key={e.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: "100%", aspectRatio: "1" }}>
            <img src={e.url} alt={e.name} title={`:${e.name}:`} loading="lazy" decoding="async" referrerPolicy="no-referrer"
              style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 6, border: "1px solid var(--border)", display: "block" }} />
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: "var(--text-muted)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", lineHeight: 1.3 }}>
            :{e.name}:
          </div>
        </div>
      ))}
    </div>
  );
}

// Card for feeds / embeds / thread rows. Previews a single row of emoji and opens
// the set's thread on click (a set can be large); pass `full` to render the whole
// grid inline, capped to a scrollable max height (the focused row in a set's own
// thread). Pass `hideHead` when the surrounding card already shows the author.
// `bookmark` (optional): { saved, saving, onToggle } renders an Add/Remove button.
// `menu` (optional): a node pinned to the right of the header (e.g. a ⋯ menu).
export function EmojiSetCard({ event, profiles, onOpenProfile, onOpen, hideHead = false, full = false, bookmark = null, menu = null }) {
  const { title, emojis } = emojiSetInfo(event);
  const shown = emojis.slice(0, 8);
  const extra = emojis.length - shown.length;
  return (
    <div
      className="note-embed"
      onClick={full ? undefined : e => { e.stopPropagation(); onOpen?.(event); }}
      role="presentation"
      style={full ? { cursor: "default" } : undefined}
    >
      <div className="note-embed-head">
        {!hideHead && (
          <>
            <div onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} role="presentation">
              <Avatar pk={event.pubkey} profiles={profiles} size={20} />
            </div>
            <span className="note-embed-name" onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} role="presentation">
              {displayName(event.pubkey, profiles)}
            </span>
          </>
        )}
        <span className="poll-badge" style={{ marginLeft: hideHead ? 0 : "auto" }}>
          Emoji set{full && emojis.length ? ` · ${emojis.length}` : ""}
        </span>
        {full && bookmark && (
          <button type="button" className="profile-follow-btn"
            disabled={bookmark.saving}
            onClick={e => { e.stopPropagation(); bookmark.onToggle?.(); }}
            style={{ marginLeft: "auto", flexShrink: 0, fontSize: 12, ...(bookmark.saved ? { background: "none", border: "1px solid var(--border)", color: "var(--text-muted)" } : {}) }}>
            {bookmark.saving ? "…" : bookmark.saved ? "Remove" : "Add set"}
          </button>
        )}
        {menu && (
          <div style={{ marginLeft: "auto", flexShrink: 0, display: "flex" }} onClick={e => e.stopPropagation()}>
            {menu}
          </div>
        )}
      </div>
      <div className="note-embed-text" style={{ fontWeight: 600, marginBottom: emojis.length ? 6 : 0 }}>{title}</div>
      {emojis.length > 0 && (full ? (
        <EmojiGrid emojis={emojis} minCol={44} maxHeight={150} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {shown.map(em => (
            <img key={em.name} src={em.url} alt={em.name} title={`:${em.name}:`} loading="lazy" decoding="async" referrerPolicy="no-referrer"
              style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0 }} />
          ))}
          {extra > 0 && (
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              +{extra} more
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
