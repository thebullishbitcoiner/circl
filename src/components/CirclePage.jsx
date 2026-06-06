import { useEffect, useRef, useState, memo } from "react";
import { Bk, Ck } from "./icons.jsx";
import { displayName, shortNpub } from "../utils.js";

// Persists scroll position across unmount/remount (e.g. navigating to a profile and back)
const savedScrollPositions = new Map();

export default memo(function CirclePage({ pubkey, follows = [], profiles, onOpenProfile, onBack, myFollows, onFollow, onUnfollow }) {
  const ownerName = displayName(pubkey, profiles);
  const scrollRef = useRef(null);
  const [query, setQuery] = useState("");

  // Restore scroll position after mount (rAF ensures layout is settled)
  useEffect(() => {
    const el = scrollRef.current;
    const saved = savedScrollPositions.get(pubkey);
    if (!el || !saved) return;
    const frame = requestAnimationFrame(() => { el.scrollTop = saved; });
    return () => cancelAnimationFrame(frame);
  }, [pubkey]);

  return (
    <div className="slide-panel-scroll" ref={scrollRef} onScroll={() => savedScrollPositions.set(pubkey, scrollRef.current?.scrollTop ?? 0)}>
      <div className="panel-bar">
        <button type="button" className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span className="panel-bar-logo">{ownerName}'s Circle</span>
      </div>

      {follows.length > 0 && (
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

      {follows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No frens yet</div>
        </div>
      ) : (() => {
        const q = query.trim().toLowerCase();
        const visible = q
          ? follows.filter(pk => {
              const fp = profiles?.[pk] || {};
              return (
                displayName(pk, profiles).toLowerCase().includes(q) ||
                (fp.nip05 || "").toLowerCase().includes(q) ||
                shortNpub(pk).toLowerCase().includes(q)
              );
            })
          : follows;
        return visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No results</div>
          </div>
        ) : (
        <div className="circle-grid">
          {visible.map((pk, i) => {
            const fp = profiles?.[pk] || {};
            const fn = displayName(pk, profiles);
            const iFollow = myFollows?.includes(pk);
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
                  {iFollow && onUnfollow && (
                    <button
                      type="button"
                      className="circle-unfollow-btn"
                      onClick={e => { e.stopPropagation(); onUnfollow(pk); }}
                    >
                      Unfollow
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        );
      })()}
    </div>
  );
});
