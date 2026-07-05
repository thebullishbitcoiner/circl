import { useState } from "react";
import { useNavigation } from "../context/NavigationContext.jsx";

export default function MutedNoteGate({ event, children, skipUserMute = false }) {
  const { isMuted, isContentMuted } = useNavigation();
  const [revealed, setRevealed] = useState(false);
  const reason = revealed ? null : (isContentMuted?.(event) || (!skipUserMute && isMuted?.(event?.pubkey) ? "user" : null));
  if (!reason) return children;
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 16px",
      borderBottom: "1px solid var(--border)",
      gap: 12,
    }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif" }}>
        {reason === "user" ? "Muted user" : <>Muted · <span style={{ color: "var(--text-faint)" }}>{reason}</span></>}
      </span>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setRevealed(true); }}
        style={{
          flexShrink: 0,
          fontSize: 12,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 600,
          color: "var(--primary)",
          background: "transparent",
          border: "1px solid var(--primary)",
          borderRadius: 20,
          padding: "3px 12px",
          cursor: "pointer",
        }}
      >
        Show
      </button>
    </div>
  );
}
