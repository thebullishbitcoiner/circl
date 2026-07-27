import { useState } from "react";

const xBtnStyle = {
  display: "flex", alignItems: "center", justifyContent: "center",
  border: "none", background: "none", padding: 0, cursor: "pointer",
  color: "inherit", font: "inherit", lineHeight: 1,
};

export default function TagChipInput({ tags, onChange, placeholder = "Add a tag…", style }) {
  const [draft, setDraft] = useState("");

  const commit = (raw) => {
    const t = raw.trim().replace(/^#/, "");
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div
      style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6,
        padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)",
        background: "var(--surface)", cursor: "text", ...style,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.querySelector("input")?.focus(); }}
    >
      {tags.map((tag, i) => (
        <span key={tag} className="tagged-chip">
          #{tag}
          <button type="button" style={xBtnStyle} className="tagged-chip-x" onClick={() => onChange(tags.filter((_, idx) => idx !== i))}>✕</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        placeholder={tags.length ? "" : placeholder}
        style={{ flex: "1 1 80px", minWidth: 80, border: "none", outline: "none", background: "none", color: "var(--text)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", padding: "2px 0" }}
      />
    </div>
  );
}
