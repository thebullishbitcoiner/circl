import { useState, useCallback, useRef } from "react";
import { pool, eventStore } from "../nostr.js";
import { displayName, relativeTime, nip19, normPubkey, isHexPubkey } from "../utils.js";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";

// Relays that advertise NIP-50 search support
const SEARCH_RELAYS = [
  "wss://relay.primal.net",
  "wss://search.nos.today",
  "wss://nostr.wine",
];

function ProfileResult({ ev, onOpenProfile }) {
  let meta = {};
  try { meta = JSON.parse(ev.content); } catch {}
  const name = meta.display_name || meta.name || "";
  const pk = ev.pubkey;
  const npub = (() => { try { const n = nip19.npubEncode(pk); return n.slice(0, 8) + "…" + n.slice(-4); } catch { return ""; } })();

  return (
    <div className="search-result" role="button" tabIndex={0}
      onClick={() => onOpenProfile?.(pk)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpenProfile?.(pk); }}
    >
      <div style={{ flexShrink: 0 }}>
        <Avatar pk={pk} profiles={{ [pk]: meta }} size={44} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="search-result-name">{name || npub}</div>
        <div className="search-result-sub" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {meta.nip05 && <span>{meta.nip05}</span>}
          {!meta.nip05 && npub && <span style={{ fontFamily: "monospace", fontSize: 11 }}>{npub}</span>}
        </div>
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
  const [tab, setTab] = useState("notes");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const subRef = useRef(null);
  const seenRef = useRef(new Set());

  const runSearch = useCallback((q, currentTab) => {
    // Cancel any in-flight subscription
    subRef.current?.unsubscribe();
    subRef.current = null;

    if (!q.trim()) { setResults([]); setLoading(false); return; }

    setLoading(true);
    setResults([]);
    seenRef.current = new Set();

    const kinds = currentTab === "people" ? [0] : [1];
    const filter = { kinds, search: q.trim(), limit: 30 };

    const sub = pool.request(SEARCH_RELAYS, [filter]).subscribe({
      next: ev => {
        if (!ev?.id || seenRef.current.has(ev.id)) return;
        seenRef.current.add(ev.id);

        // For profile results, also update the event store so avatars/names resolve
        const pk = normPubkey(ev.pubkey);
        if (isHexPubkey(pk)) eventStore.add(ev);

        setResults(prev => [...prev, ev]);
        setLoading(false);
      },
      complete: () => setLoading(false),
      error: () => setLoading(false),
    });

    subRef.current = sub;

    // Safety timeout — stop waiting after 10s
    setTimeout(() => {
      if (subRef.current === sub) {
        sub.unsubscribe();
        subRef.current = null;
        setLoading(false);
      }
    }, 10000);
  }, []);

  const handleInput = e => {
    const q = e.target.value;
    setQuery(q);
    if (!q.trim()) { setResults([]); subRef.current?.unsubscribe(); }
  };

  const handleKeyDown = e => {
    if (e.key === "Enter") runSearch(query, tab);
  };

  const handleTab = t => {
    setTab(t);
    runSearch(query, t);
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
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {query && (
            <button type="button" className="search-clear" onClick={() => { setQuery(""); setResults([]); subRef.current?.unsubscribe(); }}>
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
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <div style={{ width: 22, height: 22, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
          </div>
        )}
        {!loading && query && !results.length && (
          <div className="empty-state" style={{ paddingTop: 48 }}>
            <div className="empty-state-title">No results</div>
            <div className="empty-state-sub">Try a different search term</div>
          </div>
        )}
        {!query && (
          <div className="empty-state" style={{ paddingTop: 56 }}>
            <div className="empty-state-title">Search Nostr</div>
            <div className="empty-state-sub">Find notes and people across the network</div>
          </div>
        )}
        {results.map(ev =>
          tab === "people"
            ? <ProfileResult key={ev.id || ev.pubkey} ev={ev} profiles={profiles} onOpenProfile={onOpenProfile} />
            : <NoteResult key={ev.id} ev={ev} profiles={profiles} onOpenProfile={onOpenProfile} onOpenThread={onOpenThread} />
        )}
      </div>
    </div>
  );
}
