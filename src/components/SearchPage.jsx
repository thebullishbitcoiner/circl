import { useState, useCallback, useRef } from "react";
import { pool } from "../nostr.js";
import { displayName, relativeTime, nip19 } from "../utils.js";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";

const SEARCH_RELAY = "wss://relay.primal.net";

function ProfileResult({ ev, profiles, onOpenProfile }) {
  let meta = {};
  try { meta = JSON.parse(ev.content); } catch {}
  const name = meta.display_name || meta.name || "";
  const about = (meta.about || "").slice(0, 100);
  const pic = meta.picture;
  const pk = ev.pubkey;

  return (
    <div className="search-result" role="button" tabIndex={0}
      onClick={() => onOpenProfile?.(pk)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpenProfile?.(pk); }}
    >
      <div style={{ flexShrink: 0 }}>
        <Avatar pk={pk} profiles={{ [pk]: meta }} size={40} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="search-result-name">{name || displayName(pk, {})}</div>
        {about && <div className="search-result-sub">{about}</div>}
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
        <Avatar pk={ev.pubkey} profiles={profiles} size={32} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span className="search-result-name" style={{ fontSize: 13 }}>{displayName(ev.pubkey, profiles)}</span>
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{relativeTime(ev.created_at)}</span>
        </div>
        <NoteContent
          content={ev.content}
          profiles={profiles}
          allEvents={[]}
          allowEmbeds={false}
          className="search-note-text"
        />
      </div>
    </div>
  );
}

export default function SearchPage({ profiles, onOpenProfile, onOpenThread }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("notes"); // "notes" | "people"
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const subRef = useRef(null);

  const runSearch = useCallback((q, kind) => {
    if (subRef.current) { subRef.current.unsubscribe(); subRef.current = null; }
    if (!q.trim()) { setResults([]); return; }

    setLoading(true);
    setResults([]);
    const seen = new Set();
    const collected = [];

    subRef.current = pool.request([SEARCH_RELAY], [{ kinds: [kind], search: q.trim(), limit: 30 }])
      .subscribe({
        next: ev => {
          if (seen.has(ev.id)) return;
          seen.add(ev.id);
          collected.push(ev);
          setResults([...collected]);
        },
        error: () => setLoading(false),
        complete: () => setLoading(false),
      });
  }, []);

  const handleInput = e => {
    const q = e.target.value;
    setQuery(q);
    runSearch(q, tab === "notes" ? 1 : 0);
  };

  const handleTab = t => {
    setTab(t);
    runSearch(query, t === "notes" ? 1 : 0);
  };

  return (
    <div className="search-shell">
      <div className="search-bar-wrap">
        <div className="search-bar">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, color: "var(--text-faint)" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search notes and people…"
            value={query}
            onChange={handleInput}
            autoFocus
          />
          {query && (
            <button type="button" className="search-clear" onClick={() => { setQuery(""); setResults([]); }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
        <div className="search-tabs">
          <button type="button" className={`search-tab${tab === "notes" ? " active" : ""}`} onClick={() => handleTab("notes")}>Notes</button>
          <button type="button" className={`search-tab${tab === "people" ? " active" : ""}`} onClick={() => handleTab("people")}>People</button>
        </div>
      </div>

      <div className="search-results">
        {loading && !results.length && (
          <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
            <div style={{ width: 20, height: 20, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
          </div>
        )}
        {!loading && query && !results.length && (
          <div className="empty-state" style={{ paddingTop: 40 }}>
            <div className="empty-state-title">No results</div>
            <div className="empty-state-sub">Try a different search term</div>
          </div>
        )}
        {!query && (
          <div className="empty-state" style={{ paddingTop: 48 }}>
            <div className="empty-state-title">Search Nostr</div>
            <div className="empty-state-sub">Find notes and people across the network</div>
          </div>
        )}
        {results.map(ev =>
          tab === "people"
            ? <ProfileResult key={ev.id} ev={ev} profiles={profiles} onOpenProfile={onOpenProfile} />
            : <NoteResult key={ev.id} ev={ev} profiles={profiles} onOpenProfile={onOpenProfile} onOpenThread={onOpenThread} />
        )}
      </div>
    </div>
  );
}
