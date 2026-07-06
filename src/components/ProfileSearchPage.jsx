import { useState, useCallback, useRef, useMemo } from "react";
import useProfiles from "../hooks/useProfiles.js";
import useSearchRelays from "../hooks/useSearchRelays.js";
import { pool, eventStore } from "../nostr.js";
import { displayName, normPubkey, isHexPubkey } from "../utils.js";
import { NoteResult } from "./SearchPage.jsx";

const DEFAULT_SEARCH_RELAYS = [
  "wss://relay.primal.net",
  "wss://search.nos.today",
  "wss://nostr.wine",
];

const NOTE_LIMIT = 30;
const MAX_RECENT = 10;

const TIME_OPTIONS = [
  { label: "Anytime",    sinceOffset: null },
  { label: "Last week",  sinceOffset: 7 * 86400 },
  { label: "Last month", sinceOffset: 30 * 86400 },
  { label: "Last 90 days", sinceOffset: 90 * 86400 },
  { label: "Last year",  sinceOffset: 365 * 86400 },
];

const STORAGE_KEY = "circl_profile_search";

function profileKey(pubkeys) {
  return [...pubkeys].sort().join(",");
}

function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

function loadRecent(pubkeys) {
  return loadAll()[profileKey(pubkeys)] || [];
}

function saveRecent(pubkeys, searches) {
  const all = loadAll();
  if (searches.length) all[profileKey(pubkeys)] = searches;
  else delete all[profileKey(pubkeys)];
  if (Object.keys(all).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  else localStorage.removeItem(STORAGE_KEY);
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <div style={{ width: 22, height: 22, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
    </div>
  );
}

function DeleteBtn({ onDelete }) {
  return (
    <button
      type="button"
      className="recent-delete-btn"
      onClick={e => { e.stopPropagation(); onDelete(); }}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onDelete(); } }}
      aria-label="Remove"
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  );
}

function RecentItem({ item, onSelect, onDelete }) {
  const timeLabel = (TIME_OPTIONS.find(o => o.sinceOffset === (item.time ?? null)) ?? TIME_OPTIONS[0]).label;

  return (
    <div className="search-result" role="button" tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelect(item); }}
    >
      <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="search-result-name">{item.query}</div>
        <div className="recent-item-filters"><span className="recent-item-chip">{timeLabel}</span></div>
      </div>
      <DeleteBtn onDelete={onDelete} />
    </div>
  );
}

export default function ProfileSearchPage({ pubkeys, myPubkey, profiles, onBack, onOpenProfile, onOpenThread }) {
  const configuredRelays = useSearchRelays(myPubkey);
  const searchRelays = configuredRelays.length > 0 ? configuredRelays.map(r => r.url) : DEFAULT_SEARCH_RELAYS;

  const [query,          setQuery]          = useState("");
  const [noteResults,    setNoteResults]    = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [hasSearched,    setHasSearched]    = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => loadRecent(pubkeys));
  const [timeFilter,     setTimeFilter]     = useState(null);

  const noteSubRef  = useRef(null);
  const noteSeenRef = useRef(new Set());

  const resultPks = useMemo(() => [...new Set(noteResults.map(ev => ev.pubkey))], [noteResults]);
  const { profiles: resultProfiles } = useProfiles({ pubkeys: resultPks });
  const mergedProfiles = useMemo(() => ({ ...profiles, ...resultProfiles }), [profiles, resultProfiles]);

  const profileName = useMemo(() => displayName(pubkeys[0], mergedProfiles), [pubkeys, mergedProfiles]);

  const addRecent = useCallback((q, time) => {
    setRecentSearches(prev => {
      const next = [
        { query: q, time: time ?? null, ts: Date.now() },
        ...prev.filter(r => !(r.query === q && (r.time ?? null) === (time ?? null))),
      ].slice(0, MAX_RECENT);
      saveRecent(pubkeys, next);
      return next;
    });
  }, [pubkeys]);

  const removeRecent = useCallback((item) => {
    setRecentSearches(prev => {
      const next = prev.filter(r => !(r.query === item.query && (r.time ?? null) === (item.time ?? null)));
      saveRecent(pubkeys, next);
      return next;
    });
  }, [pubkeys]);

  const clearRecent = () => {
    saveRecent(pubkeys, []);
    setRecentSearches([]);
  };

  const runSearch = useCallback((q, sinceOffset) => {
    noteSubRef.current?.unsubscribe();
    noteSeenRef.current = new Set();
    setNoteResults([]);
    setHasSearched(true);
    setLoading(true);

    const sinceTs = sinceOffset ? Math.floor(Date.now() / 1000) - sinceOffset : null;
    const filter  = { kinds: [1], search: q, authors: pubkeys, limit: NOTE_LIMIT };
    if (sinceTs) filter.since = sinceTs;

    const sub = pool.request(searchRelays, [filter]).subscribe({
      next: ev => {
        if (!ev?.id || noteSeenRef.current.has(ev.id)) return;
        if (sinceTs && ev.created_at < sinceTs) return;
        noteSeenRef.current.add(ev.id);
        const pk = normPubkey(ev.pubkey);
        if (isHexPubkey(pk)) eventStore.add(ev);
        setNoteResults(prev => [...prev, ev].sort((a, b) => b.created_at - a.created_at));
        setLoading(false);
      },
      complete: () => setLoading(false),
      error:    () => setLoading(false),
    });

    noteSubRef.current = sub;
    setTimeout(() => {
      if (noteSubRef.current === sub) { sub.unsubscribe(); noteSubRef.current = null; setLoading(false); }
    }, 10000);
  }, [searchRelays, pubkeys]);

  const handleSearch = () => {
    if (!query.trim()) return;
    addRecent(query.trim(), timeFilter);
    runSearch(query.trim(), timeFilter);
  };

  const handleKeyDown = e => {
    if (e.key === "Enter") handleSearch();
  };

  const handleClear = () => {
    noteSubRef.current?.unsubscribe();
    setQuery(""); setNoteResults([]); setLoading(false); setHasSearched(false);
  };

  const handleSelectRecent = (item) => {
    const time = item.time ?? null;
    setQuery(item.query);
    setTimeFilter(time);
    addRecent(item.query, time);
    runSearch(item.query, time);
  };

  const showRecent = !hasSearched && recentSearches.length > 0;

  return (
    <div className="search-shell">
      <div className="search-bar-wrap" style={{ paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <button type="button" className="back-btn" onClick={onBack} aria-label="Back">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: "var(--font-base)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {pubkeys.length === 1 ? (profileName ? `Search ${profileName}'s notes` : "Search notes") : "Search notes"}
          </span>
        </div>

        <div className="search-bar">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, color: "var(--text-faint)" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search notes…"
            value={query}
            onChange={e => setQuery(e.target.value)}
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

        <div className="profile-search-filters">
          <div className="profile-search-filter-label">Time posted</div>
          <div className="profile-search-filter-row">
            {TIME_OPTIONS.map(opt => (
              <button
                key={opt.label}
                type="button"
                className={`search-filter-chip${timeFilter === opt.sinceOffset ? " active" : ""}`}
                onClick={() => setTimeFilter(opt.sinceOffset)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="profile-search-submit-btn"
          onClick={handleSearch}
          disabled={!query.trim()}
        >
          Search
        </button>
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
              <RecentItem key={`${item.query}:${i}`} item={item} onSelect={handleSelectRecent} onDelete={() => removeRecent(item)} />
            ))}
          </>
        )}

        {!loading && !hasSearched && !recentSearches.length && (
          <div className="empty-state" style={{ paddingTop: 56 }}>
            <div className="empty-state-title">Search notes</div>
            <div className="empty-state-sub">Search through {pubkeys.length === 1 && profileName ? `${profileName}'s` : "these"} posts</div>
          </div>
        )}

        {!loading && hasSearched && !noteResults.length && (
          <div className="empty-state" style={{ paddingTop: 48 }}>
            <div className="empty-state-title">No results</div>
            <div className="empty-state-sub">Try a different search term or time range</div>
          </div>
        )}

        {noteResults.map(ev => (
          <NoteResult key={ev.id} ev={ev} profiles={mergedProfiles} onOpenProfile={onOpenProfile} onOpenThread={onOpenThread} />
        ))}
      </div>
    </div>
  );
}
