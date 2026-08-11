import { useEffect, useRef, useState, useMemo } from "react";
import { Bk, Ck } from "./icons.jsx";
import { displayName, shortNpub } from "../utils.js";
import { useNip05DomainMembers } from "../hooks/useNip05DomainMembers.js";
import useProfiles from "../hooks/useProfiles.js";

// Persists scroll position across unmount/remount (e.g. navigating to a profile and back)
const savedScrollPositions = new Map();

export default function Nip05DomainMembers({ domain, profiles: profilesProp, onOpenProfile, onBack, myPubkey, myFollows, onFollow, onUnfollow }) {
  const { pubkeys, loading } = useNip05DomainMembers(domain);
  const { profiles: fetchedProfiles } = useProfiles({ pubkeys });
  const profiles = useMemo(() => ({ ...fetchedProfiles, ...profilesProp }), [profilesProp, fetchedProfiles]);

  const scrollRef = useRef(null);
  const [query, setQuery] = useState("");
  const myFollowSet = useMemo(() => new Set(myFollows || []), [myFollows]);

  useEffect(() => {
    const el = scrollRef.current;
    const saved = savedScrollPositions.get(domain);
    if (!el || !saved) return;
    const frame = requestAnimationFrame(() => { el.scrollTop = saved; });
    return () => cancelAnimationFrame(frame);
  }, [domain]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const list = q
      ? pubkeys.filter(pk => {
          const fp = profiles?.[pk] || {};
          return (
            displayName(pk, profiles).toLowerCase().includes(q) ||
            (fp.nip05 || "").toLowerCase().includes(q) ||
            shortNpub(pk).toLowerCase().includes(q)
          );
        })
      : pubkeys;
    return [...list].sort((a, b) => displayName(a, profiles).localeCompare(displayName(b, profiles)));
  }, [pubkeys, profiles, q]);

  return (
    <div className="slide-panel-scroll" ref={scrollRef} onScroll={() => savedScrollPositions.set(domain, scrollRef.current?.scrollTop ?? 0)}>
      <div className="panel-bar">
        <button type="button" className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span className="panel-bar-logo" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {domain}
          {pubkeys.length > 0 && (
            <span style={{ background: "var(--primary)", color: "white", borderRadius: 50, fontSize: 11, fontWeight: 500, padding: "1px 8px", fontFamily: "'DM Sans',sans-serif" }}>
              {pubkeys.length}
            </span>
          )}
        </span>
      </div>

      {pubkeys.length > 0 && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <div className="search-bar">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, color: "var(--text-faint)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              className="search-input"
              type="text"
              placeholder="Search..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery("")}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && pubkeys.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No members found</div>
          <div className="empty-state-sub">{domain}/.well-known/nostr.json</div>
        </div>
      ) : loading && pubkeys.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <div style={{ width: 22, height: 22, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No results</div>
        </div>
      ) : (
        <div className="circle-grid">
          {visible.map(pk => {
            const fp = profiles?.[pk] || {};
            const fn = displayName(pk, profiles);
            const iFollow = myFollowSet.has(pk);
            return (
              <div
                className="circle-card"
                key={pk}
                onClick={() => onOpenProfile?.(pk)}
              >
                <div className="circle-card-inner">
                  <div className="circle-card-av">
                    {fp.picture
                      ? <img src={fp.picture} alt={fn} onError={e => { e.target.style.display = "none"; }} />
                      : fn[0]?.toUpperCase()}
                  </div>
                  <div className="circle-card-info">
                    <div className="circle-card-name">{fn}</div>
                    {fp.nip05 && (
                      <div className="circle-card-nip05"><Ck s={8} /><span>{fp.nip05}</span></div>
                    )}
                    <div className="circle-card-npub">{shortNpub(pk)}</div>
                  </div>
                  {pk !== myPubkey && (iFollow
                    ? onUnfollow && (
                      <button
                        type="button"
                        className="circle-unfollow-btn"
                        onClick={e => { e.stopPropagation(); onUnfollow(pk); }}
                      >
                        Unfollow
                      </button>
                    )
                    : onFollow && (
                      <button
                        type="button"
                        className="circle-follow-btn"
                        onClick={e => { e.stopPropagation(); onFollow(pk); }}
                      >
                        Follow
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
