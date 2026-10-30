import { useState, useEffect, useRef, useCallback } from "react";
import {
  GifApiError, nbSearch, nbBrowse, nbSuggest, nbReport, giphySearch, giphyTrending,
} from "../utils/gifProviders.js";
import { normaliseGifQuery, isSearchableGifQuery } from "../utils/gifGrid.js";

const HIDDEN_KEY = "circl_gif_hidden_v1";
const HIDDEN_MAX = 500;

function readHidden() {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]")); } catch { return new Set(); }
}
function writeHidden(set) {
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set].slice(-HIDDEN_MAX))); } catch {}
}

// Once nostr.build can't be reached (unregistered origin, outage) even after
// the client's one retry, stay on Giphy for the rest of the session rather
// than re-failing on every keystroke. A bad query, a rate limit or a timeout
// is an answer, not an outage, so it doesn't switch.
let _sessionProvider = "nostrbuild";
const NO_FALLBACK = new Set(["validation", "rate_limited", "timeout"]);

const isRateLimited = e => e instanceof GifApiError && (e.code === "rate_limited" || e.status === 429);

function errorMessage(e) {
  if (isRateLimited(e)) return "Too many searches for now: give it a minute.";
  if (e instanceof GifApiError && e.code === "timeout") return "The search took too long.";
  return "Could not load GIFs.";
}

export default function useGifPicker({ onPick }) {
  const [showGif, setShowGif]         = useState(false);
  const [gifQuery, setGifQuery]       = useState("");
  const [kind, setKind]               = useState("reaction");
  const [items, setItems]             = useState([]);
  const [gifLoading, setGifLoading]   = useState(false);
  const [gifError, setGifError]       = useState("");
  const [provider, setProvider]       = useState(_sessionProvider);
  const [suggestions, setSuggestions] = useState([]);
  const [hidden, setHidden]           = useState(readHidden);
  const [retryKey, setRetryKey]       = useState(0);

  // Only the latest request's answer lands; nothing is ever cancelled (a
  // cancelled request still counts against the reader's budget).
  const seqRef = useRef(0);

  const query = normaliseGifQuery(gifQuery);
  const searching = !!query && isSearchableGifQuery(query);

  const fetchItems = useCallback(prov => {
    if (prov === "giphy") return searching ? giphySearch(query) : giphyTrending();
    return searching ? nbSearch(query) : nbBrowse(kind);
  }, [query, searching, kind]);

  const run = useCallback(async () => {
    const seq = ++seqRef.current;
    const current = () => seq === seqRef.current;
    try {
      const got = await fetchItems(_sessionProvider);
      if (!current()) return;
      setItems(got);
      setGifError("");
    } catch (e) {
      if (!current()) return;
      if (_sessionProvider === "nostrbuild" && !(e instanceof GifApiError && NO_FALLBACK.has(e.code)) && !isRateLimited(e)) {
        _sessionProvider = "giphy";
        setProvider("giphy");
        setSuggestions([]);
        try {
          const got = await fetchItems("giphy");
          if (!current()) return;
          setItems(got);
          setGifError("");
          setGifLoading(false);
          return;
        } catch (e2) { e = e2; }
        if (!current()) return;
      }
      setItems([]); // old results never show under an error
      setGifError(errorMessage(e));
    }
    if (current()) setGifLoading(false);
  }, [fetchItems]);

  // On open, on category change, and (debounced) on query change. Loading
  // shows from the first keystroke, not after the debounce.
  useEffect(() => {
    if (!showGif) return;
    if (query && !searching) { seqRef.current++; setGifLoading(false); return; } // keep what's shown
    setGifLoading(true);
    const t = setTimeout(run, query ? 250 : 0);
    return () => clearTimeout(t);
  }, [showGif, query, searching, kind, retryKey, run]);

  // Autocomplete (nostr.build only).
  useEffect(() => {
    if (!showGif || provider !== "nostrbuild" || !searching) { setSuggestions([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      nbSuggest(query)
        .then(terms => { if (!cancelled) setSuggestions(terms.filter(t => t.toLowerCase() !== query)); })
        .catch(() => { if (!cancelled) setSuggestions([]); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [showGif, provider, query, searching]);

  const close = () => {
    seqRef.current++;
    setShowGif(false);
    setGifQuery("");
    setSuggestions([]);
    setGifLoading(false);
  };

  const selectKind = k => {
    setKind(k);
    setGifQuery("");
  };

  const reportGif = (id, reason) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.add(id);
      writeHidden(next);
      return next;
    });
    nbReport(id, reason);
  };

  const pickGif = item => {
    if (!item?.url) return;
    onPick?.({
      url: item.url,
      type: "gif",
      mimeType: item.mime || undefined,
      dim: item.width && item.height ? `${item.width}x${item.height}` : undefined,
      size: item.bytes || undefined,
      alt: item.alt || undefined,
    });
    close();
  };

  return {
    showGif,
    setShowGif: v => {
      const next = typeof v === "function" ? v(showGif) : v;
      if (next) setShowGif(true); else close();
    },
    gifQuery, setGifQuery,
    query: searching ? query : "",
    kind, selectKind,
    gifs: items.filter(i => !hidden.has(i.id)),
    gifLoading, gifError,
    provider,
    suggestions,
    retry: () => setRetryKey(k => k + 1),
    reportGif,
    pickGif,
  };
}
