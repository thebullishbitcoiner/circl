import { useState, useCallback, useRef } from "react";
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

function ProfileSuggestion({ ev, onOpenProfile }) {
  let meta = {};
  try { meta = JSON.parse(ev.content); } catch {}
  const name = meta.display_name || meta.name || "";
  const pk   = ev.pubkey;
  const sub  = meta.nip05 || (() => {
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
        <NoteContent content={ev.content} profiles={profiles} allEvents={[]} allowEmbeds={false} className="search-note-text" />
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

export default function SearchPage({ profiles, onOpenProfile, onOpenThread }) {
  const [query,          setQuery]          = useState("");
  const [suggestions,    setSuggestions]    = useState([]);
  const [noteResults,    setNoteResults]    = useState([]);
  const [mode,           setMode]           = useState("suggest"); // "suggest" | "notes"
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [loadingNotes,   setLoadingNotes]   = useState(false);

  const suggestSubRef  = useRef(null);
  const noteSubRef     = useRef(null);
  const suggestSeenRef = useRef(new Set());
  const noteSeenRef    = useRef(new Set());
  const debounceRef    = useRef(null);

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
    // Typing always resets to suggest mode
    setMode("suggest");
    setNoteResults([]);
    clearTimeout(debounceRef.current);

    if (!q.trim()) {
      setSuggestions([]);
      suggestSubRef.current?.unsubscribe();
      setLoadingSuggest(false);
      return;
    }
    debounceRef.current = setTimeout(() => runPeopleSearch(q.trim()), SUGGEST_DEBOUNCE_MS);
  };

  const handleKeyDown = e => {
    if (e.key === "Enter" && query.trim()) {
      clearTimeout(debounceRef.current);
      suggestSubRef.current?.unsubscribe();
      setSuggestions([]);
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

  const loading = mode === "suggest" ? loadingSuggest : loadingNotes;
  const results = mode === "suggest" ? suggestions    : noteResults;

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
            Press Enter to search notes
          </div>
        )}
      </div>

      <div className="search-results">
        {loading && <Spinner />}

        {!loading && !query && (
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

        {results.map(ev =>
          mode === "suggest"
            ? <ProfileSuggestion key={ev.pubkey} ev={ev} onOpenProfile={onOpenProfile} />
            : <NoteResult key={ev.id} ev={ev} profiles={profiles} onOpenProfile={onOpenProfile} onOpenThread={onOpenThread} />
        )}
      </div>
    </div>
  );
}
