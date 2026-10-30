import { useState } from "react";
import { GIF_KINDS, GIF_REPORT_REASONS } from "../utils/gifProviders.js";

const VARIANTS = {
  sheet:  { root: "gif-picker",            row: "gif-search-row",        input: "gif-search-input" },
  inline: { root: "cal-inline-gif-picker", row: "cal-inline-gif-search", input: "cal-inline-gif-input" },
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function GifPicker({ picker, variant = "sheet", closeClassName }) {
  const [reporting, setReporting] = useState(null);
  const cls = VARIANTS[variant] || VARIANTS.sheet;
  const reduceMotion = prefersReducedMotion();
  const {
    gifQuery, setGifQuery, setShowGif, kind, selectKind,
    gifs, gifLoading, loadingMore, gifError, provider, hasMore, loadMore,
    suggestions, retry, reportGif, pickGif,
  } = picker;
  const isNb = provider === "nostrbuild";

  return (
    <div className={cls.root}>
      <div className={`${cls.row} gif-picker-head`}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className={cls.input}
            placeholder="Search GIFs…"
            value={gifQuery}
            onChange={e => setGifQuery(e.target.value)}
            autoFocus
          />
          {closeClassName && (
            <button type="button" className={closeClassName} onClick={() => setShowGif(false)} aria-label="Close GIF picker">✕</button>
          )}
        </div>
        {isNb && suggestions.length > 0 && (
          <div className="gif-chips">
            {suggestions.map(term => (
              <button key={term} type="button" className="gif-chip" onClick={() => setGifQuery(term)}>{term}</button>
            ))}
          </div>
        )}
        {isNb && !gifQuery.trim() && (
          <div className="gif-chips">
            {GIF_KINDS.map(([k, label]) => (
              <button key={k} type="button" className={`gif-chip${kind === k ? " active" : ""}`} onClick={() => selectKind(k)}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {reporting && (
        <div className="gif-report-panel">
          <div className="gif-report-title">Report this GIF</div>
          <div className="gif-chips" style={{ flexWrap: "wrap" }}>
            {GIF_REPORT_REASONS.map(r => (
              <button key={r} type="button" className="gif-chip" onClick={() => { reportGif(reporting, r); setReporting(null); }}>{r}</button>
            ))}
            <button type="button" className="gif-chip" onClick={() => setReporting(null)}>cancel</button>
          </div>
        </div>
      )}

      {gifLoading ? (
        <div className="gif-grid">
          {Array.from({ length: 9 }, (_, i) => <div key={i} className="gif-item gif-skeleton" />)}
        </div>
      ) : gifError && !gifs.length ? (
        <div className="gif-status">
          {gifError}
          <button type="button" className="gif-chip" onClick={retry}>Retry</button>
        </div>
      ) : !gifs.length ? (
        <div className="gif-status">No GIFs found</div>
      ) : (
        <>
          <div className="gif-grid">
            {gifs.map(g => (
              <div key={g.id} className="gif-item" onClick={() => pickGif(g)} title={g.alt || undefined}>
                <img src={reduceMotion ? g.still : g.preview} alt={g.alt || ""} loading="lazy" referrerPolicy="no-referrer" />
                {g.provider === "nostrbuild" && (
                  <button
                    type="button"
                    className="gif-report-btn"
                    aria-label="Report GIF"
                    onClick={e => { e.stopPropagation(); setReporting(g); }}
                  >⚑</button>
                )}
              </div>
            ))}
          </div>
          {hasMore && (
            <button type="button" className="gif-more" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}

      <div className="gif-attrib">
        {isNb
          ? <a href="https://nostr.build" target="_blank" rel="noopener noreferrer">GIFs from nostr.build</a>
          : <a href="https://giphy.com" target="_blank" rel="noopener noreferrer">Powered by GIPHY</a>}
      </div>
    </div>
  );
}
