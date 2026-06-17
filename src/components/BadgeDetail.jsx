import { useState } from "react";
import { createPortal } from "react-dom";
import NoteJsonModal from "./NoteJsonModal.jsx";
import Avatar from "./Avatar.jsx";
import { relativeTime, nip19, displayName } from "../utils.js";
import { broadcastEvent } from "../nostr.js";

function BadgeContextMenu({ awardEvent, onClose, onViewJson, onRemove }) {
  const copyAwardId = () => {
    let encoded = awardEvent.id || "";
    try { encoded = "nostr:" + nip19.neventEncode({ id: awardEvent.id }); } catch {}
    navigator.clipboard?.writeText(encoded).catch(() => {});
    onClose();
  };

  const copyBadgeId = () => {
    const aTag = awardEvent.tags?.find(t => t[0] === "a")?.[1] || "";
    const parts = aTag.split(":");
    let encoded = aTag;
    try { encoded = "nostr:" + nip19.naddrEncode({ kind: 30009, pubkey: parts[1], identifier: parts[2] || "" }); } catch {}
    navigator.clipboard?.writeText(encoded).catch(() => {});
    onClose();
  };

  return (
    <div className="note-card-menu" onClick={e => e.stopPropagation()}>
      <button type="button" className="note-card-menu-item" onClick={copyAwardId}>Copy Award ID</button>
      <button type="button" className="note-card-menu-item" onClick={copyBadgeId}>Copy Badge ID</button>
      <button type="button" className="note-card-menu-item" onClick={() => { broadcastEvent(awardEvent); onClose(); }}>Broadcast</button>
      <button type="button" className="note-card-menu-item" onClick={() => { onClose(); onViewJson(); }}>View JSON</button>
      {onRemove && (
        <button type="button" className="note-card-menu-item note-card-menu-item--danger" onClick={() => { onRemove(); onClose(); }}>
          Remove badge
        </button>
      )}
    </div>
  );
}

export default function BadgeDetail({ awardEvent, defEvent, profiles, isAccepted, onAccept, onRemove, onOpenProfile, onBack }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [busy,     setBusy]     = useState(false);

  const name        = defEvent?.tags?.find(t => t[0] === "name")?.[1]        || "";
  const description = defEvent?.tags?.find(t => t[0] === "description")?.[1] || "";
  const image       = defEvent?.tags?.find(t => t[0] === "image")?.[1]       || null;

  const issuerPubkey = awardEvent.pubkey;
  const issuerName   = displayName(issuerPubkey, profiles);
  const awardedAt    = relativeTime(awardEvent.created_at);

  const handleAccept = onAccept
    ? async () => {
        if (busy) return;
        setBusy(true);
        await onAccept(awardEvent);
        setBusy(false);
      }
    : null;

  const handleRemove = onRemove
    ? async () => {
        if (busy) return;
        setBusy(true);
        await onRemove(awardEvent.id);
        setBusy(false);
      }
    : null;

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
          <BadgeContextMenu
            awardEvent={awardEvent}
            onClose={() => setMenuOpen(false)}
            onViewJson={() => setJsonOpen(true)}
            onRemove={isAccepted ? handleRemove : null}
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
        {description && <div style={{ fontSize: 14, color: "var(--text-secondary, var(--text-faint))", marginBottom: 12 }}>{description}</div>}

        {/* Accept button shown only for own profile + unaccepted badges */}
        {handleAccept && (
          <button
            type="button"
            className="profile-follow-btn"
            style={{ width: "100%", justifyContent: "center", marginBottom: 12 }}
            onClick={handleAccept}
            disabled={busy}
          >
            {busy ? "Accepting…" : "Accept badge"}
          </button>
        )}

        {/* Issuer row */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 8 }}
          onClick={() => onOpenProfile?.(issuerPubkey)}
        >
          <Avatar pk={issuerPubkey} profiles={profiles} size={28} />
          <div style={{ fontSize: 13 }}>
            <span style={{ color: "var(--text-faint)" }}>Awarded by </span>
            <span style={{ fontWeight: 600 }}>{issuerName}</span>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{awardedAt}</div>
      </div>

      {jsonOpen && createPortal(
        <NoteJsonModal event={awardEvent} onClose={() => setJsonOpen(false)} />,
        document.body
      )}
    </div>
  );
}
