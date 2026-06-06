import Avatar from "./Avatar.jsx";
import { displayName, shortNpub } from "../utils.js";

export default function MutedPage({ mutes = [], profiles, onUnmute, onOpenProfile }) {
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
    </div>
  );
}
