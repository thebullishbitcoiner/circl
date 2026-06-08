import { useState } from "react";
import Avatar from "./Avatar.jsx";
import { displayName, shortNpub } from "../utils.js";

export default function CircleDetailPage({
  circle,
  profiles,
  follows = [],
  onAddMember,
  onRemoveMember,
  onRename,
  onOpenProfile,
  onCompose,
}) {
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [search, setSearch] = useState("");
  const [addErr, setAddErr] = useState("");

  if (!circle) return null;

  const handleRenameStart = () => {
    setNewTitle(circle.title);
    setRenaming(true);
  };

  const handleRenameSave = async () => {
    if (!newTitle.trim() || savingName) return;
    setSavingName(true);
    try {
      await onRename?.(circle.id, newTitle.trim());
      setRenaming(false);
    } catch {}
    setSavingName(false);
  };

  const handleRenameKey = e => {
    if (e.key === "Enter") handleRenameSave();
    if (e.key === "Escape") setRenaming(false);
  };

  const handleAdd = async pk => {
    setAddErr("");
    try {
      await onAddMember?.(circle.id, pk);
    } catch (e) {
      setAddErr(e?.message || "Could not add member");
    }
  };

  const handleRemove = async pk => {
    try {
      await onRemoveMember?.(circle.id, pk);
    } catch {}
  };

  // Follows not already in the circle, filtered by search query
  const memberSet = new Set(circle.members);
  const query = search.trim().toLowerCase();
  const suggestions = follows
    .filter(pk => !memberSet.has(pk))
    .filter(pk => {
      if (!query) return true;
      const p = profiles[pk];
      const name = (p?.display_name || p?.name || "").toLowerCase();
      const nip05 = (p?.nip05 || "").toLowerCase().split("@")[0];
      const npub = shortNpub(pk).toLowerCase();
      return name.includes(query) || nip05.includes(query) || npub.includes(query);
    })
    .slice(0, 10);

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        {renaming ? (
          <div style={{ display: "flex", flex: 1, gap: 8, alignItems: "center" }}>
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={handleRenameKey}
              style={{
                flex: 1,
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 15,
                fontWeight: 600,
                padding: "6px 10px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--surface)",
                color: "var(--text)",
                outline: "none",
              }}
            />
            <button className="profile-follow-btn" disabled={!newTitle.trim() || savingName} onClick={handleRenameSave}>
              {savingName ? "…" : "Save"}
            </button>
            <button onClick={() => setRenaming(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18 }}>✕</button>
          </div>
        ) : (
          <span className="feed-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {circle.title}
            <button
              type="button"
              onClick={handleRenameStart}
              title="Rename circle"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, lineHeight: 1 }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </span>
        )}
      </div>

      {/* Post to circle button */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
        <button
          type="button"
          className="profile-follow-btn"
          style={{ width: "100%" }}
          onClick={() => onCompose?.(circle)}
        >
          Post to this circle
        </button>
      </div>

      {/* Members section */}
      <div style={{ padding: "10px 16px 4px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>
        Members ({circle.members.length})
      </div>

      {circle.members.length === 0 && (
        <div style={{ padding: "12px 16px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-muted)" }}>
          No members yet — add people below.
        </div>
      )}

      {circle.members.map(pk => {
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
              style={{ flexShrink: 0, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)" }}
              onClick={() => handleRemove(pk)}
            >
              Remove
            </button>
          </div>
        );
      })}

      {/* Add people section */}
      <div style={{ padding: "12px 16px 4px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".5px", borderTop: circle.members.length > 0 ? "1px solid var(--border)" : "none", marginTop: circle.members.length > 0 ? 8 : 0 }}>
        Add People
      </div>

      <div style={{ padding: "0 16px 8px" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search people you follow…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 14,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--surface)",
            color: "var(--text)",
            outline: "none",
          }}
        />
        {addErr && <div style={{ marginTop: 6, fontSize: 12, color: "#E05C8A", fontFamily: "'DM Sans',sans-serif" }}>{addErr}</div>}
      </div>

      {suggestions.map(pk => {
        const name = displayName(pk, profiles);
        return (
          <div key={pk} className="list-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px" }}>
            <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => onOpenProfile?.(pk)}>
              <Avatar pk={pk} profiles={profiles} size={36} />
            </div>
            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onOpenProfile?.(pk)}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{shortNpub(pk)}</div>
            </div>
            <button
              type="button"
              className="profile-follow-btn"
              style={{ flexShrink: 0 }}
              onClick={() => handleAdd(pk)}
            >
              Add
            </button>
          </div>
        );
      })}

      {query && suggestions.length === 0 && (
        <div style={{ padding: "12px 16px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-muted)" }}>
          No matching follows found.
        </div>
      )}
    </div>
  );
}
