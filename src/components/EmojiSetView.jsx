import { useMemo, useState } from "react";
import Avatar from "./Avatar.jsx";
import { Bk } from "./icons.jsx";
import { displayName } from "../utils.js";
import useProfiles from "../hooks/useProfiles.js";

const EMOJI_SET_KIND = 30030;

export function emojiSetInfo(event) {
  const dTag = event?.tags?.find(t => t[0] === "d")?.[1] ?? "";
  const title = event?.tags?.find(t => t[0] === "title")?.[1] || dTag || "Emoji set";
  const emojis = [...new Map(
    (event?.tags || [])
      .filter(t => t[0] === "emoji" && t[1] && t[2])
      .map(t => [t[1], { name: t[1], url: t[2] }])
  ).values()];
  const aTag = `${EMOJI_SET_KIND}:${event?.pubkey}:${dTag}`;
  return { dTag, title, emojis, aTag };
}

export default function EmojiSetView({ event, profiles: propProfiles, onBack, onOpenProfile, mySets = [], onAddSet }) {
  const { profiles: localProfiles } = useProfiles({ pubkeys: event ? [event.pubkey] : [] });
  const profiles = useMemo(() => ({ ...propProfiles, ...localProfiles }), [propProfiles, localProfiles]);

  const { title, emojis, aTag } = useMemo(() => emojiSetInfo(event), [event]);
  const alreadyAdded = mySets.some(s => s.aTag === aTag);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleAdd = async () => {
    if (!onAddSet) return;
    setSaving(true); setErr("");
    try { await onAddSet(event); }
    catch (e) { setErr(e?.message || "Could not save — check your signer"); }
    finally { setSaving(false); }
  };

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <button className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <div>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{title}</span>
          <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: 8 }}>
            {emojis.length} {emojis.length === 1 ? "emoji" : "emojis"}
          </span>
        </div>
      </div>

      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => onOpenProfile?.(event.pubkey)} role="presentation">
          <Avatar pk={event.pubkey} profiles={profiles} size={32} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-muted)" }}>
            by{" "}
            <span style={{ color: "var(--text)", fontWeight: 600, cursor: "pointer" }}
              onClick={() => onOpenProfile?.(event.pubkey)} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenProfile?.(event.pubkey); } }}>
              {displayName(event.pubkey, profiles)}
            </span>
          </div>
        </div>
        {onAddSet && (
          <button type="button"
            className="profile-follow-btn"
            disabled={alreadyAdded || saving}
            onClick={handleAdd}
            style={{ flexShrink: 0, ...(alreadyAdded ? { background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "default" } : {}) }}>
            {saving ? "…" : alreadyAdded ? "Added" : "Add set"}
          </button>
        )}
      </div>

      {err && (
        <div style={{ padding: "8px 16px", fontSize: 12, color: "#E05C8A", fontFamily: "'DM Sans',sans-serif" }}>{err}</div>
      )}

      {emojis.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No emojis</div>
          <div className="empty-state-sub">This set doesn&apos;t list any emoji</div>
        </div>
      ) : (
        <div style={{ padding: "14px 16px 40px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 12 }}>
          {emojis.map(e => (
            <div key={e.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: "100%", aspectRatio: "1" }}>
                <img src={e.url} alt={e.name} title={`:${e.name}:`} loading="lazy" decoding="async" referrerPolicy="no-referrer"
                  style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 6, border: "1px solid var(--border)", display: "block" }} />
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: "var(--text-muted)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", lineHeight: 1.3 }}>
                :{e.name}:
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
