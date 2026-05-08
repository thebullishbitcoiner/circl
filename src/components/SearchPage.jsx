import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { PrimalCache } from "applesauce-extra";
import { eventStore } from "../nostr.js";
import { displayName, relativeTime, nip19 } from "../utils.js";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";

const ARCHIVES_API = "https://api.nostrarchives.com";

async function searchRest(q, currentTab) {
  const res = await fetch(
    `${ARCHIVES_API}/v1/search?q=${encodeURIComponent(q)}&limit=30`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(res.statusText);
  const data = await res.json();
  if (currentTab === "people") {
    return (data.profiles || []).map(p => ({
      id: p.pubkey,
      pubkey: p.pubkey,
      kind: 0,
      created_at: p.last_active_at || 0,
      content: JSON.stringify({
        name: p.name,
        display_name: p.display_name,
        picture: p.picture,
        nip05: p.nip05,
        lud16: p.lud16,
        follower_count: p.follower_count,
      }),
      tags: [],
      sig: "",
    }));
  }
  return (data.notes || []).map(n => n.event).filter(Boolean);
}

function ProfileResult({ ev, onOpenProfile }) {
  let meta = {};
  try { meta = JSON.parse(ev.content); } catch {}
  const name = meta.display_name || meta.name || "";
  const pk = ev.pubkey;
  const npub = (() => { try { const n = nip19.npubEncode(pk); return n.slice(0, 8) + "…" + n.slice(-4); } catch { return ""; } })();
  const followers = meta.follower_count != null ? meta.follower_count.toLocaleString() + " followers" : null;

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
          {followers && <span>{followers}</span>}
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
  const abortRef = useRef(null);
const primal = useMemo(() => new PrimalCache(), []);
  useEffect(() => () => primal.close(), [primal]);

  const runSearch = useCallback(async (q, currentTab) => {
    if (abortRef.current) abortRef.current.cancelled = true;
    const abort = { cancelled: false };
    abortRef.current = abort;

    if (!q.trim()) { setResults([]); setLoading(false); return; }

    setLoading(true);
    setResults([]);

    try {
      let evs = [];
      try {
        evs = await searchRest(q.trim(), currentTab);
      } catch {}

      if (abort.cancelled) return;

      if (!evs.length) {
        evs = currentTab === "people"
          ? await primal.userSearch(q.trim(), 30)
          : await primal.search({ query: q.trim(), limit: 30 });
      }

      if (abort.cancelled) return;

      for (const ev of evs) {
        if (ev.sig) eventStore.add(ev);
      }
      setResults(evs);
    } catch {
      if (!abort.cancelled) setResults([]);
    } finally {
      if (!abort.cancelled) setLoading(false);
    }
  }, [primal]);

  const handleInput = e => {
    const q = e.target.value;
    setQuery(q);
    if (!q.trim()) setResults([]);
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
            ? <ProfileResult key={ev.id} ev={ev} profiles={profiles} onOpenProfile={onOpenProfile} />
            : <NoteResult key={ev.id} ev={ev} profiles={profiles} onOpenProfile={onOpenProfile} onOpenThread={onOpenThread} />
        )}
      </div>
    </div>
  );
}
