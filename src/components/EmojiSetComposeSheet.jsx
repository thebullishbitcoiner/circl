import { useState } from "react";
import { createPortal } from "react-dom";
import { sheetPortal } from "../utils/sheetPortal.js";
import Overlay from "./Overlay.jsx";
import { emojiSetInfo } from "./EmojiSetView.jsx";

const SHORTCODE_RE = /^[a-zA-Z0-9_-]+$/;

const slugify = s =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function EmojiSetComposeSheet({ publishEvent, existingSet, myEmoji = [], onSaved, onDismiss }) {
  const editing = !!existingSet;
  const existing = editing ? emojiSetInfo(existingSet) : null;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [rows, setRows] = useState(
    existing?.emojis.length ? existing.emojis.map(e => ({ ...e })) : [{ name: "", url: "" }]
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const setRow = (i, patch) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows(rs => [...rs, { name: "", url: "" }]);
  const removeRow = i => setRows(rs => (rs.length === 1 ? rs : rs.filter((_, j) => j !== i)));

  const importMine = () => {
    setRows(rs => {
      const have = new Set(rs.map(r => r.name.trim()).filter(Boolean));
      const add = myEmoji.filter(e => !have.has(e.name)).map(e => ({ name: e.name, url: e.url }));
      const base = rs.filter(r => r.name.trim() || r.url.trim());
      return [...base, ...add, ...(add.length ? [] : [{ name: "", url: "" }])];
    });
  };

  const clean = rows
    .map(r => ({ name: r.name.trim().replace(/:/g, ""), url: r.url.trim() }))
    .filter(r => r.name && r.url);
  const badName = rows.some(r => r.name.trim() && !SHORTCODE_RE.test(r.name.trim().replace(/:/g, "")));
  const dupeName = (() => {
    const seen = new Set();
    for (const r of clean) { if (seen.has(r.name)) return true; seen.add(r.name); }
    return false;
  })();
  const canSave = title.trim() && clean.length > 0 && !badName && !dupeName && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true); setErr(null);
    const d = editing ? existing.dTag : `${slugify(title) || "emoji-set"}-${Math.floor(Date.now() / 1000)}`;
    const tags = [
      ["d", d],
      ["title", title.trim()],
      ...clean.map(e => ["emoji", e.name, e.url]),
    ];
    const ev = await publishEvent({ kind: 30030, content: "", tags });
    setBusy(false);
    if (!ev) { setErr("Failed to publish — check your signer."); return; }
    onSaved?.(ev);
    onDismiss?.();
  };

  const inputStyle = {
    fontFamily: "'DM Sans',sans-serif", fontSize: 14, padding: "8px 10px",
    border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)",
    color: "var(--text)", outline: "none", width: "100%", boxSizing: "border-box",
  };

  return createPortal(
    <Overlay onDismiss={onDismiss} compose>
      <div style={{ width: "100%", maxWidth: 700, background: "var(--bg)", borderRadius: "20px 20px 0 0", paddingTop: 8, maxHeight: "90vh", display: "flex", flexDirection: "column", animation: "slideUp .22s cubic-bezier(.4,0,.2,1)" }} onClick={e => e.stopPropagation()}>
        <div className="action-sheet-handle" />
        <div className="highlight-sheet-title">{editing ? "Edit Emoji Set" : "New Emoji Set"}</div>

        <div style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "0 16px" }}>
          <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="Set title *"
            value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />

          {myEmoji.length > 0 && (
            <button type="button" onClick={importMine}
              style={{ ...inputStyle, width: "auto", cursor: "pointer", color: "var(--primary)", border: "1px solid var(--primary-soft, var(--border))", marginBottom: 10 }}>
              + Import my {myEmoji.length} emoji
            </button>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input style={{ ...inputStyle, flex: "0 0 130px" }} placeholder="shortcode"
                  value={r.name} onChange={e => setRow(i, { name: e.target.value.replace(/:/g, "") })} />
                <input style={{ ...inputStyle, flex: 1, minWidth: 0 }} placeholder="Image URL"
                  value={r.url} onChange={e => setRow(i, { url: e.target.value })} />
                {r.url.trim() && (
                  <img src={r.url} alt="" style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 4, flexShrink: 0, border: "1px solid var(--border)" }}
                    onError={e => { e.currentTarget.style.visibility = "hidden"; }}
                    onLoad={e => { e.currentTarget.style.visibility = ""; }} />
                )}
                <button type="button" onClick={() => removeRow(i)} aria-label="Remove"
                  style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 18, flexShrink: 0, padding: "0 2px" }}>×</button>
              </div>
            ))}
          </div>

          <button type="button" onClick={addRow}
            style={{ ...inputStyle, width: "auto", cursor: "pointer", color: "var(--text-muted)", marginTop: 10 }}>
            + Add emoji
          </button>

          {badName && <div className="highlight-sheet-error">Shortcodes: letters, numbers, hyphens, underscores only</div>}
          {dupeName && <div className="highlight-sheet-error">Duplicate shortcode</div>}
          {err && <div className="highlight-sheet-error">{err}</div>}
        </div>

        <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
          <button type="button" className="action-sheet-btn highlight-sheet-submit"
            style={{ width: "100%", background: "var(--primary)", color: "#fff", borderRadius: 10 }}
            onClick={handleSave} disabled={!canSave}>
            {busy ? "Publishing…" : editing ? "Save Set" : "Create Set"}
          </button>
        </div>
        <button type="button" className="action-sheet-cancel" onClick={onDismiss}>Cancel</button>
      </div>
    </Overlay>,
    sheetPortal()
  );
}
