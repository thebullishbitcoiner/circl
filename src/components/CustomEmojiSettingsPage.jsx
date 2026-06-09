import { useState } from "react";
import EmojiSetDiscoveryPage from "./EmojiSetDiscoveryPage.jsx";

const SHORTCODE_RE = /^[a-zA-Z0-9_-]+$/;

export default function CustomEmojiSettingsPage({
  emojis = [], sets = [],
  addEmoji, removeEmoji, addSet, removeSet,
  loading, onBack,
}) {
  const [subPage, setSubPage] = useState(null); // "discover"
  const [name,    setName]    = useState("");
  const [url,     setUrl]     = useState("");
  const [saving,  setSaving]  = useState(null); // name or "__add__" or "set:<aTag>"
  const [err,     setErr]     = useState("");

  // ── discovery sub-page ───────────────────────────────────────────────────────

  if (subPage === "discover") {
    return (
      <EmojiSetDiscoveryPage
        onBack={() => setSubPage(null)}
        bookmarkedATags={sets.map(s => s.aTag)}
        addSet={addSet}
        addEmoji={addEmoji}
      />
    );
  }

  // ── main page ────────────────────────────────────────────────────────────────

  const trimName = name.trim();
  const trimUrl  = url.trim();
  const isValidName = trimName && SHORTCODE_RE.test(trimName);
  const isDupe      = emojis.some(e => e.name === trimName);
  const canAdd      = isValidName && trimUrl && !isDupe && !saving;

  const handleAdd = async () => {
    if (!canAdd) return;
    setErr("");
    setSaving("__add__");
    try {
      await addEmoji(trimName, trimUrl);
      setName(""); setUrl("");
    } catch (e) {
      setErr(e?.message || "Could not save emoji list");
    } finally {
      setSaving(null);
    }
  };

  const handleRemoveEmoji = async emojiName => {
    if (saving) return;
    setErr("");
    setSaving(emojiName);
    try { await removeEmoji(emojiName); }
    catch (e) { setErr(e?.message || "Could not save emoji list"); }
    finally { setSaving(null); }
  };

  const handleRemoveSet = async aTag => {
    if (saving) return;
    setErr("");
    setSaving(`set:${aTag}`);
    try { await removeSet(aTag); }
    catch (e) { setErr(e?.message || "Could not save emoji list"); }
    finally { setSaving(null); }
  };

  const inputStyle = {
    fontFamily: "'DM Sans',sans-serif", fontSize: 14,
    padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8,
    background: "var(--surface)", color: "var(--text)", outline: "none",
  };

  const totalCount = emojis.length + sets.reduce((n, s) => n + s.emojis.length, 0);

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <button type="button" onClick={onBack}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 20, lineHeight: 1, padding: "0 8px 0 0" }}
          aria-label="Back">‹</button>
        <span className="feed-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Custom Emoji
          {totalCount > 0 && (
            <span style={{ background: "var(--primary)", color: "white", borderRadius: 50, fontSize: 11, fontWeight: 500, padding: "1px 8px", fontFamily: "'DM Sans',sans-serif" }}>
              {totalCount}
            </span>
          )}
        </span>
      </div>

      {/* Discover sets row */}
      <div className="settings-row" onClick={() => setSubPage("discover")}
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <div className="settings-row-label">Discover Emoji Sets</div>
          <div className="settings-row-sub">Browse and add sets from the network</div>
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 18 }}>›</div>
      </div>

      {err && <div style={{ margin: "8px 16px 0", fontSize: 12, color: "#E05C8A", fontFamily: "'DM Sans',sans-serif" }}>{err}</div>}

      {/* Bookmarked sets */}
      {sets.length > 0 && (
        <>
          <div className="settings-section-title">Bookmarked Sets</div>
          {sets.map(({ aTag, title, emojis: setEmojis }) => (
            <div key={aTag} className="list-row"
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
              {/* preview */}
              <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                {setEmojis.slice(0, 4).map(e => (
                  <img key={e.name} src={e.url} alt={e.name} title={`:${e.name}:`}
                    style={{ width: 22, height: 22, objectFit: "contain" }} />
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--text-muted)" }}>{setEmojis.length} emoji</div>
              </div>
              <button type="button"
                className="profile-follow-btn"
                disabled={saving === `set:${aTag}`}
                style={{ flexShrink: 0, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                onClick={() => handleRemoveSet(aTag)}>
                {saving === `set:${aTag}` ? "…" : "Remove"}
              </button>
            </div>
          ))}
        </>
      )}

      {/* Add individual emoji form */}
      <div className="settings-section-title">Individual Emoji</div>
      <div style={{ padding: "8px 16px 12px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="shortcode (e.g. doge)"
            style={{ ...inputStyle, flex: "0 0 140px" }}
          />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="Image URL…"
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
          {trimUrl && (
            <img src={trimUrl} alt="preview"
              style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 4, flexShrink: 0, border: "1px solid var(--border)" }}
              onError={e => { e.currentTarget.style.display = "none"; }}
              onLoad={e => { e.currentTarget.style.display = ""; }} />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className="profile-follow-btn" disabled={!canAdd} onClick={handleAdd}>
            {saving === "__add__" ? "…" : "Add emoji"}
          </button>
          {!isValidName && trimName && (
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif" }}>
              Only letters, numbers, hyphens, underscores
            </span>
          )}
          {isDupe && (
            <span style={{ fontSize: 12, color: "#E05C8A", fontFamily: "'DM Sans',sans-serif" }}>
              Name already exists
            </span>
          )}
        </div>
      </div>

      {loading && emojis.length === 0 && sets.length === 0 ? (
        <div className="empty-state"><div className="empty-state-sub">Loading…</div></div>
      ) : emojis.length === 0 ? (
        <div style={{ padding: "12px 16px" }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-muted)" }}>
            No individual emoji yet. Add one above or browse sets.
          </div>
        </div>
      ) : (
        emojis.map(({ name: n, url: u }) => (
          <div key={n} className="list-row"
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
            <img src={u} alt={n}
              style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 4, flexShrink: 0, border: "1px solid var(--border)" }} />
            <div style={{ flex: 1, minWidth: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "var(--text)" }}>
              :{n}:
            </div>
            <button type="button"
              className="profile-follow-btn"
              disabled={saving === n}
              style={{ flexShrink: 0, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)" }}
              onClick={() => handleRemoveEmoji(n)}>
              {saving === n ? "…" : "Remove"}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
