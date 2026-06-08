import { useState } from "react";

export default function MyCirclesPage({ circles = [], onOpenCircle, onCreate, onDelete }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setErr("");
    try {
      await onCreate(trimmed);
      setNewName("");
      setCreating(false);
    } catch (e) {
      setErr(e?.message || "Could not create circle");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = e => {
    if (e.key === "Enter") handleCreate();
    if (e.key === "Escape") { setCreating(false); setNewName(""); setErr(""); }
  };

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <span className="feed-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          My Circles
          {circles.length > 0 && (
            <span style={{ background: "var(--primary)", color: "white", borderRadius: 50, fontSize: 11, fontWeight: 500, padding: "1px 8px", fontFamily: "'DM Sans',sans-serif" }}>
              {circles.length}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => { setCreating(true); setErr(""); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontSize: 22, lineHeight: 1, padding: "0 4px" }}
          title="New circle"
        >
          +
        </button>
      </div>

      {creating && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Circle name…"
              style={{
                flex: 1,
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
            <button
              type="button"
              className="profile-follow-btn"
              disabled={!newName.trim() || saving}
              onClick={handleCreate}
            >
              {saving ? "…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setNewName(""); setErr(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18 }}
            >
              ✕
            </button>
          </div>
          {err && <div style={{ marginTop: 6, fontSize: 12, color: "#E05C8A", fontFamily: "'DM Sans',sans-serif" }}>{err}</div>}
        </div>
      )}

      {circles.length === 0 && !creating ? (
        <div className="empty-state">
          <div className="empty-state-title">No circles yet</div>
          <div className="empty-state-sub">Create a circle to group people and post to them</div>
        </div>
      ) : (
        <div>
          {circles.map(circle => (
            <div
              key={circle.id}
              className="list-row"
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }}
              onClick={() => onOpenCircle?.(circle)}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 18,
                  color: "white",
                }}
              >
                ○
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {circle.title}
                </div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                  {circle.members.length === 1 ? "1 person" : `${circle.members.length} people`}
                </div>
              </div>
              <button
                type="button"
                className="profile-follow-btn"
                style={{ flexShrink: 0, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                onClick={e => { e.stopPropagation(); onDelete?.(circle.id); }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
