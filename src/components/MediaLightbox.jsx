import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

const preloadedUrls = new Set();

export default function MediaLightbox({ items, index, onClose, onIndexChange }) {
  const n = items?.length ?? 0;
  const safe = n > 0 ? Math.max(0, Math.min(index, n - 1)) : 0;
  const current = items?.[safe];
  const touchX = useRef(null);

  const go = useCallback(
    delta => {
      if (n <= 1) return;
      onIndexChange(Math.max(0, Math.min(n - 1, index + delta)));
    },
    [n, index, onIndexChange]
  );

  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, go]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    for (const item of items || []) {
      if (!item?.url || item.type !== "image" || preloadedUrls.has(item.url)) continue;
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.referrerPolicy = "no-referrer";
      img.src = item.url;
      preloadedUrls.add(item.url);
    }
  }, [items]);

  if (!items?.length) return null;

  return createPortal(
    <div className="media-lightbox" onClick={onClose} role="presentation">
      <button
        type="button"
        className="media-lightbox-close"
        onClick={e => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
      >
        ×
      </button>
      {n > 1 && (
        <button
          type="button"
          className="media-lightbox-nav media-lightbox-prev"
          onClick={e => { e.stopPropagation(); go(-1); }}
          disabled={safe <= 0}
          aria-label="Previous"
        >
          ‹
        </button>
      )}
      {n > 1 && (
        <button
          type="button"
          className="media-lightbox-nav media-lightbox-next"
          onClick={e => { e.stopPropagation(); go(1); }}
          disabled={safe >= n - 1}
          aria-label="Next"
        >
          ›
        </button>
      )}
      <div
        className="media-lightbox-stage"
        onClick={e => e.stopPropagation()}
        onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          if (touchX.current == null || n <= 1) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (dx > 56) go(-1);
          else if (dx < -56) go(1);
          touchX.current = null;
        }}
      >
        {current?.type === "video" ? (
          <video
            key={current.url}
            src={current.url}
            controls
            autoPlay
            playsInline
            preload="metadata"
          />
        ) : (
          <img key={current?.url} src={current?.url} alt="" referrerPolicy="no-referrer" loading="eager" />
        )}
      </div>
      {n > 1 && (
        <div className="media-lightbox-counter" onClick={e => e.stopPropagation()}>
          {safe + 1} / {n}
        </div>
      )}
    </div>,
    document.body
  );
}
