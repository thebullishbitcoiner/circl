import { useState } from "react";
import { useNavigation } from "../context/NavigationContext.jsx";
import Avatar from "./Avatar.jsx";
import { displayName, nip05OrNpub, relativeTime } from "../utils.js";

export default function MutedNoteGate({ event, children, profiles, skipUserMute = false }) {
  const { isMuted, isContentMuted } = useNavigation();
  const [revealed, setRevealed] = useState(false);
  const reason = revealed ? null : (isContentMuted?.(event) || (!skipUserMute && isMuted?.(event?.pubkey) ? "user" : null));
  if (!reason) return children;
  return (
    <div className="note-card">
      <div className="note-header">
        <div style={{ flexShrink: 0 }}>
          <Avatar pk={event.pubkey} profiles={profiles} size={36} />
        </div>
        <div className="note-meta">
          <span className="note-name">{displayName(event.pubkey, profiles)}</span>
          <span className="note-npub">{nip05OrNpub(event.pubkey, profiles)}</span>
          <span className="meta-dot" aria-hidden="true">·</span>
          <span className="note-time">{relativeTime(event.created_at)}</span>
        </div>
        <button type="button" className="note-card-menu-btn" style={{ opacity: 0.3, cursor: "default" }} disabled>
          <span /><span /><span />
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0 6px" }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif" }}>
          {reason === "user" ? "Muted user" : <>Muted · <span style={{ color: "var(--text-faint)" }}>{reason}</span></>}
        </span>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setRevealed(true); }}
          style={{ flexShrink: 0, fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: "var(--primary)", background: "transparent", border: "1px solid var(--primary)", borderRadius: 20, padding: "3px 12px", cursor: "pointer" }}
        >
          Show
        </button>
      </div>
    </div>
  );
}
