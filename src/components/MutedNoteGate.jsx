import { useState } from "react";
import { useNavigation } from "../context/NavigationContext.jsx";
import Avatar from "./Avatar.jsx";
import { displayName, nip05OrNpub, relativeTime } from "../utils.js";

export default function MutedNoteGate({ event, children, profiles, skipUserMute = false, skipThreadMute = false, onOpenProfile }) {
  const { isMuted, isContentMuted } = useNavigation();
  const [revealed, setRevealed] = useState(false);
  const contentReason = isContentMuted?.(event);
  const reason = revealed ? null : (
    (contentReason === "thread" && skipThreadMute ? null : contentReason) ||
    (!skipUserMute && isMuted?.(event?.pubkey) ? "user" : null)
  );
  if (!reason) return children;
  return (
    <div className="note-card">
      {event.kind === 6 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-faint)", marginBottom: 4, paddingLeft: 2 }}>
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <span style={{ cursor: "pointer", fontWeight: 500 }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
            {displayName(event.pubkey, profiles)}
          </span>
          &nbsp;reposted
        </div>
      ) : (
      <div className="note-header">
        <div style={{ flexShrink: 0, cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
          <Avatar pk={event.pubkey} profiles={profiles} size={36} />
        </div>
        <div className="note-meta">
          <div className="note-meta-top">
            <span className="note-name" style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>{displayName(event.pubkey, profiles)}</span>
            <span className="meta-dot" aria-hidden="true">·</span>
            <span className="note-time">{relativeTime(event.created_at)}</span>
          </div>
          <span className="note-npub">{nip05OrNpub(event.pubkey, profiles)}</span>
        </div>
        <button type="button" className="note-card-menu-btn" style={{ opacity: 0.3, cursor: "default" }} disabled>
          <span /><span /><span />
        </button>
      </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0 6px" }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif" }}>
          {reason === "user" ? "Muted user" : reason === "thread" ? "Muted thread" : <>Muted · <span style={{ color: "var(--text-faint)" }}>{reason}</span></>}
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
