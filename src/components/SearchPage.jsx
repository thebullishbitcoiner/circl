import { useState, useCallback, useRef, useMemo } from "react";
import useProfiles from "../hooks/useProfiles.js";
import { pool, eventStore } from "../nostr.js";
import { displayName, relativeTime, nip19, normPubkey, isHexPubkey } from "../utils.js";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";

const SEARCH_RELAYS = [
  "wss://relay.primal.net",
  "wss://search.nos.today",
  "wss://nostr.wine",
];

const SUGGEST_LIMIT = 8;
const NOTE_LIMIT    = 30;
const SUGGEST_DEBOUNCE_MS = 350;
const RECENT_KEY    = "circl_recent_searches";
const MAX_RECENT    = 8;

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}

function IconCircle({ children, color = "var(--primary)" }) {
  return (
    <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color }}>
      {children}
    </div>
  );
}

function RecentSearchItem({ item, profiles, onSelect }) {
  if (item.type === "people") {
    const pk  = item.pubkey;
    const p   = profiles?.[pk] || {};
    const name = p.display_name || p.name || "";
    const sub  = p.nip05 || (() => { try { const n = nip19.npubEncode(pk); return n.slice(0, 8) + "…" + n.slice(-4); } catch { return ""; } })();
    return (
      <div className="search-result" role="button" tabIndex={0}
        onClick={() => onSelect(item)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelect(item); }}
      >
        <div style={{ flexShrink: 0 }}>
          <Avatar pk={pk} profiles={profiles} size={40} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="search-result-name">{name || sub}</div>
          {name && sub && <div className="search-result-sub">{sub}</div>}
        </div>
      </div>
    );
  }

  const label = item.type === "hashtag" ? `#${item.query}` : item.query;
  const sub   = item.type === "hashtag" ? "Hashtag" : "Notes";
  return (
    <div className="search-result" role="button" tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelect(item); }}
    >
      <IconCircle>
        {item.type === "hashtag"
          ? <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>#</span>
          : <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        }
      </IconCircle>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="search-result-name">{label}</div>
        <div className="search-result-sub">{sub}</div>
      </div>
    </div>
  );
}

function ProfileSuggestion({ ev, onOpenProfile }) {
  let meta = {};
  try { meta = JSON.parse(ev.content); } catch {}
  const name = (typeof meta.display_name === "string" ? meta.display_name : "") || (typeof meta.name === "string" ? meta.name : "");
  const pk   = ev.pubkey;
  const sub  = (typeof meta.nip05 === "string" ? meta.nip05 : "") || (() => {
    try { const n = nip19.npubEncode(pk); return n.slice(0, 8) + "…" + n.slice(-4); } catch { return ""; }
  })();

  return (
    <div className="search-result" role="button" tabIndex={0}
      onClick={() => onOpenProfile?.(pk)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpenProfile?.(pk); }}
    >
      <div style={{ flexShrink: 0 }}>
        <Avatar pk={pk} profiles={{ [pk]: meta }} size={40} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="search-result-name">{name || sub}</div>
        {name && sub && <div className="search-result-sub">{sub}</div>}
      </div>
    </div>
  );
}

function NoteResult({ ev, profiles, onOpenProfile, onOpenThread }) {
  return (
    <div className="search-result note" role="button" tabIndex={0}
      onClick={() => onOpenThread?.(ev)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpenThread?.(ev); }}
    >
      <div style={{ flexShrink: 0 }}>
        <Avatar pk={ev.pubkey} profiles={profiles} size={36} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span className="search-result-name" style={{ fontSize: 13 }}>{displayName(ev.pubkey, profiles)}</span>
          <span style={{ fontSize: 11, color: "var(--text-faint)", flexShrink: 0 }}>{relativeTime(ev.created_at)}</span>
        </div>
        <NoteContent content={ev.content} tags={ev.tags} profiles={profiles} allEvents={[]} allowEmbeds={false} className="search-note-text" />
      </div>
    </div>
  );
}

function HashtagSuggestion({ tag, onOpenHashtag }) {
  return (
    <div className="search-result" role="button" tabIndex={0}
      onClick={() => onOpenHashtag?.(tag)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpenHashtag?.(tag); }}
    >
      <IconCircle>
        <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>#</span>
      </IconCircle>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="search-result-name">#{tag}</div>
        <div className="search-result-sub">Browse hashtag</div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <div style={{ width: 22, height: 22, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
    </div>
  );
}

export default function SearchPage({ profiles, onOpenProfile, onOpenThread, onOpenHashtag }) {
  const [query,          setQuery]          = useState("");
  const [suggestions,    setSuggestions]    = useState([]);
  const [noteResults,    setNoteResults]    = useState([]);
  const [mode,           setMode]           = useState("suggest"); // "suggest" | "notes"
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [loadingNotes,   setLoadingNotes]   = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => loadRecent());

  const resultPks = useMemo(() => {
    const pks = new Set(noteResults.map(ev => ev.pubkey));
    for (const ev of suggestions) if (ev.pubkey) pks.add(ev.pubkey);
    return [...pks];
  }, [noteResults, suggestions]);
  const { profiles: resultProfiles } = useProfiles({ pubkeys: resultPks });
  const mergedProfiles = useMemo(() => ({ ...profiles, ...resultProfiles }), [profiles, resultProfiles]);

  const suggestSubRef  = useRef(null);
  const noteSubRef     = useRef(null);
  const suggestSeenRef = useRef(new Set());
  const noteSeenRef    = useRef(new Set());
  const debounceRef    = useRef(null);

  const addRecent = useCallback((entry) => {
    setRecentSearches(prev => {
      const key = entry.type === "people" ? entry.pubkey : entry.query;
      const next = [{ ...entry, ts: Date.now() }, ...prev.filter(r => !(r.type === entry.type && (r.type === "people" ? r.pubkey === key : r.query === key)))].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecentSearches([]);
  };

  const runPeopleSearch = useCallback(q => {
    suggestSubRef.current?.unsubscribe();
    suggestSeenRef.current = new Set();
    setSuggestions([]);
    setLoadingSuggest(true);

    const sub = pool.request(SEARCH_RELAYS, [{ kinds: [0], search: q, limit: SUGGEST_LIMIT }]).subscribe({
      next: ev => {
        if (!ev?.id || suggestSeenRef.current.has(ev.id)) return;
        suggestSeenRef.current.add(ev.id);
        const pk = normPubkey(ev.pubkey);
        if (isHexPubkey(pk)) eventStore.add(ev);
        setSuggestions(prev => [...prev, ev]);
        setLoadingSuggest(false);
      },
      complete: () => setLoadingSuggest(false),
      error:    () => setLoadingSuggest(false),
    });

    suggestSubRef.current = sub;
    setTimeout(() => {
      if (suggestSubRef.current === sub) { sub.unsubscribe(); suggestSubRef.current = null; setLoadingSuggest(false); }
    }, 8000);
  }, []);

  const runNoteSearch = useCallback(q => {
    noteSubRef.current?.unsubscribe();
    noteSeenRef.current = new Set();
    setNoteResults([]);
    setLoadingNotes(true);

    const sub = pool.request(SEARCH_RELAYS, [{ kinds: [1], search: q, limit: NOTE_LIMIT }]).subscribe({
      next: ev => {
        if (!ev?.id || noteSeenRef.current.has(ev.id)) return;
        noteSeenRef.current.add(ev.id);
        const pk = normPubkey(ev.pubkey);
        if (isHexPubkey(pk)) eventStore.add(ev);
        setNoteResults(prev => [...prev, ev].sort((a, b) => b.created_at - a.created_at));
        setLoadingNotes(false);
      },
      complete: () => setLoadingNotes(false),
      error:    () => setLoadingNotes(false),
    });

    noteSubRef.current = sub;
    setTimeout(() => {
      if (noteSubRef.current === sub) { sub.unsubscribe(); noteSubRef.current = null; setLoadingNotes(false); }
    }, 10000);
  }, []);

  const handleInput = e => {
    const q = e.target.value;
    setQuery(q);
    setMode("suggest");
    setNoteResults([]);
    clearTimeout(debounceRef.current);

    if (!q.trim()) {
      setSuggestions([]);
      suggestSubRef.current?.unsubscribe();
      setLoadingSuggest(false);
      return;
    }
    if (q.trim().startsWith("#")) return;
    debounceRef.current = setTimeout(() => runPeopleSearch(q.trim()), SUGGEST_DEBOUNCE_MS);
  };

  const handleKeyDown = e => {
    if (e.key === "Enter" && query.trim()) {
      clearTimeout(debounceRef.current);
      suggestSubRef.current?.unsubscribe();
      setSuggestions([]);
      if (query.trim().startsWith("#")) {
        const tag = query.trim().slice(1);
        addRecent({ type: "hashtag", query: tag });
        onOpenHashtag?.(tag);
        return;
      }
      addRecent({ type: "notes", query: query.trim() });
      setMode("notes");
      runNoteSearch(query.trim());
    }
  };

  const handleClear = () => {
    clearTimeout(debounceRef.current);
    suggestSubRef.current?.unsubscribe();
    noteSubRef.current?.unsubscribe();
    setQuery(""); setSuggestions([]); setNoteResults([]);
    setMode("suggest"); setLoadingSuggest(false); setLoadingNotes(false);
  };

  const handleSelectRecent = item => {
    if (item.type === "hashtag") {
      addRecent({ type: "hashtag", query: item.query });
      onOpenHashtag?.(item.query);
    } else if (item.type === "notes") {
      setQuery(item.query);
      setMode("notes");
      setSuggestions([]);
      addRecent({ type: "notes", query: item.query });
      runNoteSearch(item.query);
    } else {
      addRecent({ type: "people", pubkey: item.pubkey });
      onOpenProfile?.(item.pubkey);
    }
  };

  const loading = mode === "suggest" ? loadingSuggest : loadingNotes;
  const results = mode === "suggest" ? suggestions    : noteResults;
  const showRecent = !query && recentSearches.length > 0;

  return (
    <div className="search-shell">
      <div className="search-bar-wrap" style={{ paddingBottom: 12 }}>
        <div className="search-bar">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, color: "var(--text-faint)" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search notes and people…"
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {query && (
            <button type="button" className="search-clear" onClick={handleClear}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
        {query.trim() && mode === "suggest" && (
          <div style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center", marginTop: 8, fontFamily: "'DM Sans',sans-serif" }}>
            {query.trim().startsWith("#") ? `Press Enter to browse ${query.trim()}` : "Press Enter to search notes"}
          </div>
        )}
      </div>

      <div className="search-results">
        {loading && <Spinner />}

        {!loading && showRecent && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px 4px", fontFamily: "'DM Sans',sans-serif" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Recent</span>
              <button type="button" onClick={clearRecent} style={{ fontSize: 12, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: "2px 0", fontFamily: "inherit" }}>
                Clear
              </button>
            </div>
            {recentSearches.map((item, i) => (
              <RecentSearchItem key={`${item.type}:${item.pubkey ?? item.query}:${i}`} item={item} profiles={mergedProfiles} onSelect={handleSelectRecent} />
            ))}
          </>
        )}

        {!loading && !query && !recentSearches.length && (
          <div className="empty-state" style={{ paddingTop: 56 }}>
            <div className="empty-state-title">Search Nostr</div>
            <div className="empty-state-sub">People appear as you type · Enter to search notes</div>
          </div>
        )}

        {!loading && query && !results.length && mode === "notes" && (
          <div className="empty-state" style={{ paddingTop: 48 }}>
            <div className="empty-state-title">No results</div>
            <div className="empty-state-sub">Try a different search term</div>
          </div>
        )}

        {mode === "suggest" && query.trim().startsWith("#") && (
          <HashtagSuggestion tag={query.trim().slice(1)} onOpenHashtag={tag => { addRecent({ type: "hashtag", query: tag }); onOpenHashtag?.(tag); }} />
        )}
        {!(mode === "suggest" && query.trim().startsWith("#")) && results.map(ev =>
          mode === "suggest"
            ? <ProfileSuggestion key={ev.pubkey} ev={ev} onOpenProfile={pk => { addRecent({ type: "people", pubkey: pk }); onOpenProfile?.(pk); }} />
            : <NoteResult key={ev.id} ev={ev} profiles={mergedProfiles} onOpenProfile={onOpenProfile} onOpenThread={onOpenThread} />
        )}
      </div>
    </div>
  );
}
