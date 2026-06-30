import { useState } from "react";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import { nip19 } from "../utils.js";

export default function PodcastShowCard({ showMeta, podcastPubkey, onSelect }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);

  const title       = showMeta?.tags?.find(t => t[0] === "title")?.[1]       ?? "Untitled Podcast";
  const image       = showMeta?.tags?.find(t => t[0] === "image")?.[1]       ?? null;
  const description = showMeta?.tags?.find(t => t[0] === "summary")?.[1]
                   ?? showMeta?.content
                   ?? "";

  const handleCardClick = (e) => {
    if (menuOpen) return;
    onSelect?.({ pubkey: podcastPubkey, meta: showMeta ?? null });
  };

  return (
    <>
      <div
        className="podcast-show-card"
        style={{ zIndex: menuOpen ? 1 : undefined }}
        onClick={handleCardClick}
      >
        {image ? (
          <img
            className="podcast-show-art"
            src={image}
            alt={title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={e => { e.target.style.display = "none"; }}
          />
        ) : (
          <div className="podcast-show-art podcast-show-art-placeholder" />
        )}
        <div className="podcast-show-info">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
            <div className="podcast-show-title">{title}</div>
            <button
              type="button"
              className="note-card-menu-btn"
              style={{ flexShrink: 0, marginTop: -2 }}
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
              aria-label="More options"
            >
              <span /><span /><span />
            </button>
            {menuOpen && showMeta && (
              <NoteContextMenu
                event={showMeta}
                onClose={() => setMenuOpen(false)}
                onViewJson={() => { setJsonOpen(true); setMenuOpen(false); }}
              />
            )}
          </div>
          {description ? (
            <div className="podcast-show-desc">{description}</div>
          ) : null}
        </div>
      </div>
      {jsonOpen && showMeta && (
        <NoteJsonModal event={showMeta} onClose={() => setJsonOpen(false)} />
      )}
    </>
  );
}
