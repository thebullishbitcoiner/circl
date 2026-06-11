import { useState, useRef, useEffect } from "react";
import Avatar from "./Avatar.jsx";
import { displayName, shortNpub } from "../utils.js";

export default function MutedPage({ mutes = [], muteEvent, profiles, onUnmute, onOpenProfile }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <span className="feed-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Muted Users
          {mutes.length > 0 && (
            <span style={{ background: "var(--primary)", color: "white", borderRadius: 50, fontSize: 11, fontWeight: 500, padding: "1px 8px", fontFamily: "'DM Sans',sans-serif" }}>
              {mutes.length}
            </span>
          )}
        </span>
        <div ref={menuRef} style={{ marginLeft: "auto", position: "relative" }}>
          <button
            type="button"
            className="back-btn"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3.5 }}
            onClick={() => setMenuOpen(o => !o)}
          >
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-muted)", display: "block" }} />
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-muted)", display: "block" }} />
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-muted)", display: "block" }} />
          </button>
          {menuOpen && (
            <div
              className="note-card-menu"
              style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100, minWidth: 160 }}
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                className="note-card-menu-item"
                onClick={() => { setMenuOpen(false); setShowJson(true); }}
              >
                View Event JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {mutes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No muted users</div>
          <div className="empty-state-sub">Users you mute will appear here</div>
        </div>
      ) : (
        <div>
          {mutes.map(pk => {
            const name = displayName(pk, profiles);
            return (
              <div key={pk} className="list-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
                <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => onOpenProfile?.(pk)}>
                  <Avatar pk={pk} profiles={profiles} size={40} />
                </div>
                <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onOpenProfile?.(pk)}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{shortNpub(pk)}</div>
                </div>
                <button
                  type="button"
                  className="profile-follow-btn"
                  style={{ flexShrink: 0 }}
                  onClick={() => onUnmute?.(pk)}
                >
                  Unmute
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Event JSON modal */}
      {showJson && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setShowJson(false)}
        >
          <div
            style={{ background: "var(--surface)", borderRadius: 12, width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--border)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 15, color: "var(--text)" }}>Event JSON</span>
              <button type="button" onClick={() => setShowJson(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            <pre style={{ margin: 0, padding: "14px 16px", overflowY: "auto", fontFamily: "monospace", fontSize: 12, color: "var(--text)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {muteEvent ? JSON.stringify(muteEvent, null, 2) : "No event found — mute list has not been published yet."}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
