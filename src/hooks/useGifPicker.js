import { useState, useEffect, useRef, useCallback } from "react";
import {
  GIF_PAGE_SIZE, GifApiError,
  nbSearch, nbBrowse, nbSuggest, nbReport, giphySearch, giphyTrending,
} from "../utils/gifProviders.js";

const HIDDEN_KEY = "circl_gif_hidden_v1";
const HIDDEN_MAX = 500;

function readHidden() {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]")); } catch { return new Set(); }
}
function writeHidden(set) {
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set].slice(-HIDDEN_MAX))); } catch {}
}

// Once nostr.build fails for any reason other than a bad query (unregistered
// origin, outage, network), stay on Giphy for the rest of the session rather
// than re-failing on every keystroke.
let _sessionProvider = "nostrbuild";

// A single Latin letter is too broad to be a useful search (per nostr.build's
// picker guidance); other scripts and emoji can be meaningful on their own.
const isSearchable = q => q.length > 1 || !/^[a-z]$/i.test(q);

function errorMessage(e) {
  if (e instanceof GifApiError && e.code === "rate_limited") return "Too many requests — try again in a minute";
  return "Could not load GIFs";
}

export default function useGifPicker({ onPick }) {
  const [showGif, setShowGif]         = useState(false);
  const [gifQuery, setGifQuery]       = useState("");
  const [kind, setKind]               = useState("reaction");
  const [items, setItems]             = useState([]);
  const [gifLoading, setGifLoading]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [gifError, setGifError]       = useState("");
  const [provider, setProvider]       = useState(_sessionProvider);
  const [hasMore, setHasMore]         = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [hidden, setHidden]           = useState(readHidden);
  const [retryKey, setRetryKey]       = useState(0);

  const seqRef = useRef(0);
  const pageRef = useRef({ offset: 0, version: null });

  const query = gifQuery.trim();

  const fetchPage = useCallback(async (offset, prov) => {
    if (prov === "giphy") {
      return query && isSearchable(query) ? giphySearch(query) : giphyTrending();
    }
    return query && isSearchable(query)
      ? nbSearch({ q: query, offset })
      : nbBrowse({ kind, offset });
  }, [query, kind]);

  const runFirstPage = useCallback(async () => {
    const seq = ++seqRef.current;
    setGifLoading(true);
    setGifError("");
    const apply = (page, prov) => {
      if (seq !== seqRef.current) return;
      pageRef.current = { offset: 0, version: page.version };
      setItems(page.items);
      setHasMore(prov === "nostrbuild" && page.items.length === GIF_PAGE_SIZE && GIF_PAGE_SIZE < page.count);
      setGifLoading(false);
    };
    try {
      apply(await fetchPage(0, _sessionProvider), _sessionProvider);
    } catch (e) {
      if (seq !== seqRef.current) return;
      const fallback = _sessionProvider === "nostrbuild"
        && !(e instanceof GifApiError && (e.code === "validation" || e.code === "rate_limited"));
      if (fallback) {
        _sessionProvider = "giphy";
        setProvider("giphy");
        setSuggestions([]);
        try { apply(await fetchPage(0, "giphy"), "giphy"); return; } catch (e2) { e = e2; }
        if (seq !== seqRef.current) return;
      }
      setItems([]);
      setHasMore(false);
      setGifError(errorMessage(e));
      setGifLoading(false);
    }
  }, [fetchPage]);

  // First page: on open, on category change, and (debounced) on query change.
  useEffect(() => {
    if (!showGif) return;
    if (query && !isSearchable(query)) return;
    const t = setTimeout(runFirstPage, query ? 250 : 0);
    return () => clearTimeout(t);
  }, [showGif, query, kind, retryKey, runFirstPage]);

  // Autocomplete (nostr.build only).
  useEffect(() => {
    if (!showGif || provider !== "nostrbuild" || !query || !isSearchable(query)) { setSuggestions([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      nbSuggest(query)
        .then(terms => { if (!cancelled) setSuggestions(terms.filter(t => t.toLowerCase() !== query.toLowerCase())); })
        .catch(() => { if (!cancelled) setSuggestions([]); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [showGif, provider, query]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || provider !== "nostrbuild") return;
    const seq = seqRef.current;
    const offset = pageRef.current.offset + GIF_PAGE_SIZE;
    setLoadingMore(true);
    try {
      const page = await fetchPage(offset, "nostrbuild");
      if (seq !== seqRef.current) return;
      // The index was rebuilt / browse order reshuffled since page one: offsets
      // no longer line up, so start over rather than show duplicates or gaps.
      if (page.version !== pageRef.current.version) { runFirstPage(); return; }
      pageRef.current = { offset, version: page.version };
      setItems(prev => {
        const seen = new Set(prev.map(i => i.id));
        return [...prev, ...page.items.filter(i => !seen.has(i.id))];
      });
      setHasMore(page.items.length === GIF_PAGE_SIZE && offset + GIF_PAGE_SIZE < page.count);
    } catch (e) {
      if (seq === seqRef.current) setGifError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const close = () => {
    seqRef.current++;
    setShowGif(false);
    setGifQuery("");
    setSuggestions([]);
  };

  const selectKind = k => {
    setKind(k);
    setGifQuery("");
  };

  const reportGif = (item, reason) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.add(item.id);
      writeHidden(next);
      return next;
    });
    if (item.provider === "nostrbuild") nbReport(item.id, reason);
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
    kind, selectKind,
    gifs: items.filter(i => !hidden.has(i.id)),
    gifLoading, loadingMore, gifError,
    provider, hasMore, loadMore,
    suggestions,
    retry: () => setRetryKey(k => k + 1),
    reportGif,
    pickGif,
  };
}
