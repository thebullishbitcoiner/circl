import { useState } from "react";
import { createPortal } from "react-dom";
import NoteJsonModal from "./NoteJsonModal.jsx";
import NoteText from "./NoteText.jsx";
import { nip19 } from "../utils.js";
import { broadcastEvent } from "../nostr.js";

function DefContextMenu({ defEvent, onClose, onViewJson }) {
  const copyBadgeId = () => {
    const d = defEvent.tags?.find(t => t[0] === "d")?.[1] || "";
    let encoded = `30009:${defEvent.pubkey}:${d}`;
    try { encoded = "nostr:" + nip19.naddrEncode({ kind: 30009, pubkey: defEvent.pubkey, identifier: d }); } catch {}
    navigator.clipboard?.writeText(encoded).catch(() => {});
    onClose();
  };

  return (
    <div className="note-card-menu" onClick={e => e.stopPropagation()}>
      <button type="button" className="note-card-menu-item" onClick={copyBadgeId}>Copy Badge ID</button>
      <button type="button" className="note-card-menu-item" onClick={() => { broadcastEvent(defEvent); onClose(); }}>Broadcast</button>
      <button type="button" className="note-card-menu-item" onClick={() => { onClose(); onViewJson(); }}>View JSON</button>
    </div>
  );
}

export default function BadgeDefDetail({ defEvent, profiles, onOpenProfile, onBack }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);

  const name  = defEvent?.tags?.find(t => t[0] === "name")?.[1]        || "";
  const desc  = defEvent?.tags?.find(t => t[0] === "description")?.[1] || "";
  const image = defEvent?.tags?.find(t => t[0] === "image")?.[1]       || null;
  const d     = defEvent?.tags?.find(t => t[0] === "d")?.[1]           || "";

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid var(--border)", position: "relative" }}>
        <button
          type="button"
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 13, padding: "4px 0", fontFamily: "'DM Sans', sans-serif" }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6" /></svg>
          Badges
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" className="note-card-menu-btn" onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }} aria-label="More options">
          <span /><span /><span />
        </button>
        {menuOpen && (
          <DefContextMenu
            defEvent={defEvent}
            onClose={() => setMenuOpen(false)}
            onViewJson={() => setJsonOpen(true)}
          />
        )}
      </div>

      {/* Badge image */}
      {image && (
        <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", background: "var(--surface)" }}>
          <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      )}

      {/* Badge body */}
      <div style={{ padding: "12px 16px" }}>
        {name && <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>{name}</div>}
        {desc && (
          <NoteText
            content={desc}
            profiles={profiles}
            onOpenProfile={onOpenProfile}
            className=""
            style={{ fontSize: 14, color: "var(--text-secondary, var(--text-faint))", marginBottom: 12 }}
          />
        )}
        {d && (
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "monospace", wordBreak: "break-all", marginTop: 8 }}>
            {d}
          </div>
        )}
      </div>

      {jsonOpen && createPortal(
        <NoteJsonModal event={defEvent} onClose={() => setJsonOpen(false)} />,
        document.body
      )}
    </div>
  );
}
