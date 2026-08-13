import { useEffect, useRef, useMemo, memo } from "react";
import { videoPosterUrl } from "../utils.js";

function StackedIcon() {
  return (
    <svg viewBox="0 0 18 18" width="14" height="14" fill="currentColor" aria-hidden="true">
      <rect x="2" y="6" width="10" height="10" rx="1.5" opacity=".55" />
      <rect x="6" y="2" width="10" height="10" rx="1.5" />
    </svg>
  );
}

const ProfileMediaGrid = memo(function ProfileMediaGrid({ visible = true, items, loading, exhausted, onLoadMore, onOpenThread }) {
  const sentinelRef = useRef(null);
  const loadingRef = useRef(loading);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  const gridButtons = useMemo(() => items.map(({ event, url, type, count }) => (
    <button
      key={event.id}
      type="button"
      className="profile-media-thumb"
      onClick={() => onOpenThread(event)}
    >
      {type === "video" ? (
        <>
          <video src={url} poster={videoPosterUrl(url)} playsInline preload="metadata" muted />
          <span className="profile-media-play">
            <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28" aria-hidden="true">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </span>
        </>
      ) : (
        <img src={url} alt="" loading="eager" decoding="async" referrerPolicy="no-referrer" />
      )}
      {count > 1 && (
        <span className="profile-media-multi">
          <StackedIcon />
        </span>
      )}
    </button>
  )), [items, onOpenThread]);

  // Recreate the observer when visibility changes so isFirstFire resets correctly.
  // This prevents the sentinel's immediate-fire from triggering a load when switching
  // back to this tab with items already in state.
  useEffect(() => {
    if (!visible) return;
    const el = sentinelRef.current;
    if (!el || exhausted) return;
    let isFirstFire = true;
    const obs = new IntersectionObserver(
      entries => {
        const { isIntersecting } = entries[0];
        if (isFirstFire) {
          isFirstFire = false;
          if (isIntersecting && items.length > 0) return;
        }
        if (isIntersecting && !loadingRef.current) onLoadMore();
      },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, exhausted, onLoadMore]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nothing to preserve yet — safe to stay unmounted until first visit
  if (!visible && items.length === 0 && !loading) return null;

  let content;
  if (loading && items.length === 0) {
    content = (
      <div className="profile-media-grid">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="profile-media-thumb skel" />
        ))}
      </div>
    );
  } else if (items.length === 0) {
    content = (
      <div className="empty-state">
        <div className="empty-state-title">No media yet</div>
        <div className="empty-state-sub">Images and videos will appear here</div>
      </div>
    );
  } else {
    content = (
      <>
        <div className="profile-media-grid">
          {gridButtons}
        </div>

        {!exhausted && <div ref={sentinelRef} style={{ height: 1 }} />}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "20px 0", color: "var(--text-faint)", fontSize: 13 }}>
            <div style={{ width: 14, height: 14, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
            Loading…
          </div>
        )}
      </>
    );
  }

  // Keep DOM alive when hidden so images don't reload on tab return
  return <div style={visible ? undefined : { display: "none" }}>{content}</div>;
});

export default ProfileMediaGrid;
