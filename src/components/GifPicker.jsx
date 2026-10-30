import { useState, useEffect, useRef, useId } from "react";
import { GIF_KINDS, GIF_REPORT_REASONS } from "../utils/gifProviders.js";
import { gifGrid } from "../utils/gifGrid.js";

const VARIANTS = {
  sheet:  { root: "gif-picker",            row: "gif-search-row",        input: "gif-search-input" },
  inline: { root: "cal-inline-gif-picker", row: "cal-inline-gif-search", input: "cal-inline-gif-input" },
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// On phones the keyboard would cover the category chips the picker opens on.
const isTouch = () =>
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

/** nostr.build results: masonry of pooled <video> tiles (see utils/gifGrid.js). */
function NbGrid({ items, rootRef, onPick, onReport }) {
  const ref = useRef(null);
  const gridRef = useRef(null);
  const shownRef = useRef([]);
  const cb = useRef({});
  cb.current = { onPick, onReport };

  useEffect(() => {
    const g = gifGrid(ref.current, {
      root: rootRef.current,
      onPick: gif => cb.current.onPick(gif.id),
      onReport: gif => cb.current.onReport(gif.id),
    });
    gridRef.current = g;
    return () => { g.destroy(); gridRef.current = null; shownRef.current = []; };
  }, [rootRef]);

  useEffect(() => {
    const g = gridRef.current;
    if (!g) return;
    const ids = items.map(i => i.id);
    const prev = shownRef.current;
    if (ids.length === prev.length && ids.every((id, i) => id === prev[i])) return;
    // A reported tile leaving: take just that one out, so the rest keep
    // their loaded videos and scroll position.
    const keep = new Set(ids);
    const removed = prev.filter(id => !keep.has(id));
    if (removed.length && ids.length + removed.length === prev.length && ids.every(id => prev.includes(id))) {
      removed.forEach(id => g.remove(id));
    } else {
      g.show(items.map(i => i.raw));
    }
    shownRef.current = ids;
  }, [items]);

  return <div ref={ref} className="gif-masonry" role="list" />;
}

export default function GifPicker({ picker, variant = "sheet", closeClassName }) {
  const [reporting, setReporting] = useState(null);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const uid = useId();
  const cls = VARIANTS[variant] || VARIANTS.sheet;
  const {
    gifQuery, setGifQuery, query, setShowGif, kind, selectKind,
    gifs, gifLoading, gifError, provider,
    suggestions, retry, reportGif, pickGif,
  } = picker;
  const isNb = provider === "nostrbuild";
  const showSuggestions = isNb && suggestionsOpen && suggestions.length > 0;

  useEffect(() => { setActiveSuggestion(-1); setSuggestionsOpen(true); }, [suggestions]);

  const takeSuggestion = term => {
    setGifQuery(term);
    setSuggestionsOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = e => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      // Cycles through -1 (the typed text) and each suggestion.
      setActiveSuggestion(i => {
        const next = i + step;
        return next >= suggestions.length ? -1 : next < -1 ? suggestions.length - 1 : next;
      });
    } else if (e.key === "Enter" && activeSuggestion >= 0) {
      e.preventDefault();
      takeSuggestion(suggestions[activeSuggestion]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSuggestionsOpen(false);
    }
  };

  const byId = id => gifs.find(g => g.id === id);
  const status = gifError
    ? gifError
    : gifLoading
      ? (query ? `Searching for “${query}”…` : "Loading GIFs…")
      : gifs.length
        ? `${gifs.length} GIFs`
        : query ? `No GIFs for “${query}”` : "No GIFs found";

  return (
    <div className={cls.root} ref={rootRef}>
      <div className={`${cls.row} gif-picker-head`}>
        <div className="gif-picker-title">
          <span className="gif-attrib">
            {isNb
              ? <a href="https://nostr.build" target="_blank" rel="noopener noreferrer">GIFs from nostr.build</a>
              : <a href="https://giphy.com" target="_blank" rel="noopener noreferrer">Powered by GIPHY</a>}
          </span>
          <button type="button" className={closeClassName || "gif-close-btn"} onClick={() => setShowGif(false)} aria-label="Close GIF picker">✕</button>
        </div>
        <div className="gif-field">
          <input
            ref={inputRef}
            className={cls.input}
            placeholder="Search GIFs…"
            value={gifQuery}
            onChange={e => setGifQuery(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus={!isTouch()}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls={`${uid}-suggest`}
            aria-activedescendant={showSuggestions && activeSuggestion >= 0 ? `${uid}-s${activeSuggestion}` : undefined}
            aria-describedby={`${uid}-status`}
          />
          {gifLoading && <span className="gif-spinner" aria-hidden="true" />}
          {gifQuery && (
            <button
              type="button"
              className="gif-clear-btn"
              aria-label="Clear search"
              onClick={() => { setGifQuery(""); inputRef.current?.focus(); }}
            >✕</button>
          )}
        </div>
        {showSuggestions && (
          <div className="gif-chips" role="listbox" id={`${uid}-suggest`} aria-label="Suggestions">
            {suggestions.map((term, i) => (
              <button
                key={term}
                id={`${uid}-s${i}`}
                type="button"
                role="option"
                aria-selected={i === activeSuggestion}
                tabIndex={-1}
                className={`gif-chip${i === activeSuggestion ? " active" : ""}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => takeSuggestion(term)}
              >{term}</button>
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
      </div>

      <div id={`${uid}-status`} className="sr-only" aria-live="polite">{status}</div>

      {gifError ? (
        <div className="gif-status">
          {gifError}
          <button type="button" className="gif-chip" onClick={retry}>Try again</button>
        </div>
      ) : !gifs.length && gifLoading ? (
        <div className="gif-skeleton-grid">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="gif-skeleton" />)}
        </div>
      ) : !gifs.length ? (
        <div className="gif-status">
          {query ? `No GIFs for “${query}”` : "No GIFs found"}
          {isNb && (
            <div className="gif-chips" style={{ flexWrap: "wrap", justifyContent: "center" }}>
              {GIF_KINDS.map(([k, label]) => (
                <button key={k} type="button" className="gif-chip" onClick={() => selectKind(k)}>{label}</button>
              ))}
            </div>
          )}
        </div>
      ) : isNb ? (
        <NbGrid
          items={gifs}
          rootRef={rootRef}
          onPick={id => pickGif(byId(id))}
          onReport={id => setReporting(id)}
        />
      ) : (
        <div className="gif-grid">
          {gifs.map(g => (
            <button key={g.id} type="button" className="gif-item" onClick={() => pickGif(g)} aria-label={g.alt || "GIF"}>
              <img src={prefersReducedMotion() ? g.still : g.preview} alt="" loading="lazy" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
