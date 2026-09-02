import { useState, useEffect, useMemo } from "react";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";
import { displayName } from "../utils.js";
import { useNavigation } from "../context/NavigationContext.jsx";
import useProfiles from "../hooks/useProfiles.js";

const EMOJI_SET_KIND = 30030;

export default function EmojiSetDiscoveryPage({ onBack, bookmarkedATags = [], addSet, addEmoji }) {
  const { onOpenEmojiSet } = useNavigation();
  const [sets,    setSets]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [saving,   setSaving]   = useState(null); // "set:<aTag>" | "emoji:<name>"
  const [query,    setQuery]    = useState("");
  const [err,      setErr]      = useState("");

  const authorPubkeys = useMemo(() => [...new Set(sets.map(ev => ev.pubkey))], [sets]);
  const { profiles } = useProfiles({ pubkeys: authorPubkeys });

  useEffect(() => {
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
    const received  = [];
    let cancelled   = false;

    const sub = pool.request(relayUrls, [{ kinds: [EMOJI_SET_KIND], limit: 200 }]).subscribe({
      next: raw => { eventStore.add(raw); received.push(raw); },
      complete: () => {
        if (cancelled) return;
        // deduplicate: keep latest per pubkey+d
        const byKey = new Map();
        for (const ev of received) {
          const d = ev.tags?.find(t => t[0] === "d")?.[1];
          if (!d) continue;
          const key = `${ev.pubkey}:${d}`;
          const existing = byKey.get(key);
          if (!existing || ev.created_at > existing.created_at) byKey.set(key, ev);
        }
        // only sets with at least one emoji, sorted by count desc
        const parsed = [...byKey.values()]
          .filter(ev => ev.tags?.some(t => t[0] === "emoji" && t[1] && t[2]))
          .sort((a, b) => {
            const ca = a.tags.filter(t => t[0] === "emoji").length;
            const cb = b.tags.filter(t => t[0] === "emoji").length;
            return cb - ca;
          });
        if (!cancelled) { setSets(parsed); setLoading(false); }
      },
      error: () => { if (!cancelled) setLoading(false); },
    });

    return () => { cancelled = true; sub.unsubscribe(); };
  }, []);

  const aTagOf = ev => {
    const d = ev.tags?.find(t => t[0] === "d")?.[1] ?? "";
    return `${EMOJI_SET_KIND}:${ev.pubkey}:${d}`;
  };


  const handleAddSet = async ev => {
    const key = `set:${aTagOf(ev)}`;
    setSaving(key); setErr("");
    try { await addSet(ev); }
    catch (e) { setErr(e?.message || "Could not save — check your signer"); }
    finally { setSaving(null); }
  };

  const handleAddEmoji = async (name, url) => {
    const key = `emoji:${name}`;
    setSaving(key); setErr("");
    try { await addEmoji(name, url); }
    catch (e) { setErr(e?.message || "Could not save — check your signer"); }
    finally { setSaving(null); }
  };

  const filtered = sets.filter(ev => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const title = ev.tags?.find(t => t[0] === "title")?.[1] ?? "";
    const d     = ev.tags?.find(t => t[0] === "d")?.[1] ?? "";
    const names = ev.tags.filter(t => t[0] === "emoji").map(t => t[1]).join(" ");
    return title.toLowerCase().includes(q) || d.toLowerCase().includes(q) || names.toLowerCase().includes(q);
  });

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <button type="button" onClick={onBack}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 20, lineHeight: 1, padding: "0 8px 0 0" }}>
          ‹
        </button>
        <span className="feed-title">Discover Emoji Sets</span>
      </div>

      <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search sets or shortcodes…"
          style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "'DM Sans',sans-serif", fontSize: 13, outline: "none" }}
        />
        {err && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#E05C8A", fontFamily: "'DM Sans',sans-serif" }}>{err}</div>
        )}
      </div>

      {loading ? (
        <div className="empty-state"><div className="empty-state-sub">Fetching sets from relays…</div></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No sets found</div>
          <div className="empty-state-sub">{query ? "Try a different search" : "No emoji sets available on your relays"}</div>
        </div>
      ) : filtered.map(ev => {
        const aTag      = aTagOf(ev);
        const dTag      = ev.tags?.find(t => t[0] === "d")?.[1] ?? "";
        const title     = ev.tags?.find(t => t[0] === "title")?.[1] ?? dTag;
        // deduplicate by name — relay events sometimes repeat the same emoji tag
        const setEmojis = [...new Map(
          ev.tags.filter(t => t[0] === "emoji" && t[1] && t[2]).map(t => [t[1], { name: t[1], url: t[2] }])
        ).values()];
        const bookmarked = bookmarkedATags.includes(aTag);
        const isOpen     = expanded === aTag;
        const savingSet  = saving === `set:${aTag}`;

        return (
          <div key={aTag} style={{ borderBottom: "1px solid var(--border)" }}>
            {/* set row */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px" }}>
              {/* info + preview */}
              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onOpenEmojiSet?.(ev)}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ fontWeight: 600, color: "var(--text)", display: "inline-block", maxWidth: "55%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{title}</span>
                  <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · by {displayName(ev.pubkey, profiles)}</span>
                </div>
                {!isOpen && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                    {setEmojis.slice(0, 5).map(e => (
                      <img key={e.name} src={e.url} alt={e.name} title={`:${e.name}:`}
                        style={{ width: 22, height: 22, objectFit: "contain", flexShrink: 0 }} />
                    ))}
                    {setEmojis.length > 5 && (
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        +{setEmojis.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
              {/* actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, paddingTop: 2 }}>
                <button type="button"
                  onClick={() => setExpanded(isOpen ? null : aTag)}
                  title={isOpen ? "Collapse" : "Browse emoji"}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", color: "var(--text-muted)", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
                  {isOpen ? "▲" : "▼"}
                </button>
                <button type="button"
                  disabled={bookmarked || !!saving}
                  onClick={() => handleAddSet(ev)}
                  className="profile-follow-btn"
                  style={{ ...(bookmarked ? { background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "default" } : {}) }}>
                  {savingSet ? "…" : bookmarked ? "Added" : "Add set"}
                </button>
              </div>
            </div>

            {/* expanded individual emojis */}
            {isOpen && (
              <div style={{ padding: "4px 16px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(58px, 1fr))", gap: 10 }}>
                {setEmojis.map(e => {
                  const isSaving = saving === `emoji:${e.name}`;
                  return (
                    <div key={e.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ position: "relative", width: "100%", aspectRatio: "1" }}>
                        <img src={e.url} alt={e.name}
                          style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 6, border: "1px solid var(--border)", display: "block" }} />
                        <button
                          type="button"
                          disabled={!!saving}
                          onClick={() => handleAddEmoji(e.name, e.url)}
                          title={`Add :${e.name}:`}
                          style={{
                            position: "absolute", top: -6, right: -6,
                            width: 20, height: 20, borderRadius: "50%",
                            background: isSaving ? "var(--surface)" : "var(--primary)",
                            border: "2px solid var(--bg)",
                            color: "#fff", fontSize: 14, lineHeight: 1,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: saving ? "default" : "pointer",
                            padding: 0,
                          }}
                        >
                          {isSaving ? <span style={{ fontSize: 10, color: "var(--text-muted)" }}>…</span> : "+"}
                        </button>
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: 9, color: "var(--text-muted)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", lineHeight: 1.3 }}>
                        :{e.name}:
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
