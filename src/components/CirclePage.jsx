import { useEffect, useRef, memo } from "react";
import { Bk, Ck } from "./icons.jsx";
import { displayName, shortNpub } from "../utils.js";

// Persists scroll position across unmount/remount (e.g. navigating to a profile and back)
const savedScrollPositions = new Map();

export default memo(function CirclePage({ pubkey, follows = [], profiles, onOpenProfile, onBack, myFollows, onFollow, onUnfollow }) {
  const ownerName = displayName(pubkey, profiles);
  const scrollRef = useRef(null);

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

      {follows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No frens yet</div>
        </div>
      ) : (
        <div className="circle-grid">
          {follows.map((pk, i) => {
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
      )}
    </div>
  );
});
