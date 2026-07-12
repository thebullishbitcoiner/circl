import { useState, useRef, useCallback, useEffect } from "react";
import Avatar from "./Avatar.jsx";
import useSearchRelays from "../hooks/useSearchRelays.js";
import { pool, eventStore } from "../nostr.js";
import { displayName, shortNpub, normPubkey, isHexPubkey, truncNpub } from "../utils.js";

const TABS = [
  { id: "users",    label: "Users" },
  { id: "hashtags", label: "Hashtags" },
  { id: "words",    label: "Words" },
  { id: "threads",  label: "Threads" },
];

const DEFAULT_SEARCH_RELAYS = [
  "wss://relay.primal.net",
  "wss://search.nos.today",
  "wss://nostr.wine",
];

const SUGGEST_LIMIT = 8;
const SUGGEST_DEBOUNCE_MS = 350;

function fmtFollowers(n) {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function UserSearchResult({ ev, isMuted, onMute, onOpenProfile }) {
  let meta = {};
  try { meta = JSON.parse(ev.content); } catch {}
  const name = (typeof meta.display_name === "string" ? meta.display_name : "") || (typeof meta.name === "string" ? meta.name : "");
  const pk   = ev.pubkey;
  const nip05 = typeof meta.nip05 === "string" ? meta.nip05 : "";
  const sub  = nip05 || truncNpub(pk);

  return (
    <div className="search-result" role="button" tabIndex={0}
      onClick={() => onOpenProfile?.(pk)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpenProfile?.(pk); }}
    >
      <div style={{ flexShrink: 0 }}>
        <Avatar pk={pk} profiles={{ [pk]: meta }} size={40} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="search-result-name" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || sub}</span>
          {ev.follower_count != null && (
            <span style={{ flexShrink: 0, fontSize: "calc(var(--font-base) - 4px)", fontWeight: 600, color: "var(--text-faint)", background: "var(--surface2, var(--border))", borderRadius: 99, padding: "1px 6px", fontFamily: "'DM Sans',sans-serif", letterSpacing: "0.02em" }}>
              {fmtFollowers(ev.follower_count)} followers
            </span>
          )}
        </div>
        {name && sub && <div className="search-result-sub">{sub}</div>}
      </div>
      <button
        type="button"
        className="profile-follow-btn"
        style={{ flexShrink: 0 }}
        disabled={isMuted}
        onClick={e => { e.stopPropagation(); onMute?.(pk); }}
      >
        {isMuted ? "Muted" : "Mute"}
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 20, height: 20, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
    </div>
  );
}

export default function MutedPage({
  pubkey,
  mutes = [], hashtags = [], words = [], threads = [],
  profiles,
  onUnmute, onMuteUser, onMuteHashtag, onUnmuteHashtag, onMuteWord, onUnmuteWord, onUnmuteThread,
  onOpenProfile,
}) {
  const [tab, setTab] = useState("users");
  const [hashtagInput, setHashtagInput] = useState("");
  const [wordInput, setWordInput] = useState("");
  const hashtagInputRef = useRef(null);
  const wordInputRef = useRef(null);

  const configuredRelays = useSearchRelays(pubkey);
  const searchRelays = configuredRelays.length > 0 ? configuredRelays.map(r => r.url) : DEFAULT_SEARCH_RELAYS;
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const userSubRef  = useRef(null);
  const userSeenRef = useRef(new Set());
  const userDebounceRef = useRef(null);
  const userAbortRef = useRef(null);

  const runUserSearch = useCallback(async q => {
    userAbortRef.current?.abort();
    const ctrl = new AbortController();
    userAbortRef.current = ctrl;

    userSubRef.current?.unsubscribe();
    userSeenRef.current = new Set();
    setUserResults([]);
    setUserSearchLoading(true);

    try {
      const res = await fetch(
        `https://api.nostrarchives.com/v1/search/suggest?q=${encodeURIComponent(q)}&limit=${SUGGEST_LIMIT}`,
        { signal: ctrl.signal },
      );
      if (ctrl.signal.aborted) return;
      if (res.ok) {
        const data = await res.json();
        if (ctrl.signal.aborted) return;
        if (data.suggestions?.length > 0) {
          setUserResults(data.suggestions.map(s => ({
            pubkey: s.pubkey,
            content: JSON.stringify({ name: s.name, display_name: s.display_name, picture: s.picture }),
            id: `api-${s.pubkey}`,
            follower_count: s.follower_count ?? null,
          })));
          setUserSearchLoading(false);
          return;
        }
      }
    } catch (e) {
      if (e.name === "AbortError") return;
    }

    const sub = pool.request(searchRelays, [{ kinds: [0], search: q, limit: SUGGEST_LIMIT }]).subscribe({
      next: ev => {
        if (!ev?.id || userSeenRef.current.has(ev.id)) return;
        userSeenRef.current.add(ev.id);
        const pk = normPubkey(ev.pubkey);
        if (isHexPubkey(pk)) eventStore.add(ev);
        setUserResults(prev => [...prev, ev]);
        setUserSearchLoading(false);
      },
      complete: () => setUserSearchLoading(false),
      error:    () => setUserSearchLoading(false),
    });

    userSubRef.current = sub;
    setTimeout(() => {
      if (userSubRef.current === sub) { sub.unsubscribe(); userSubRef.current = null; setUserSearchLoading(false); }
    }, 8000);
  }, [searchRelays]);

  const handleUserSearchInput = e => {
    const q = e.target.value;
    setUserQuery(q);
    clearTimeout(userDebounceRef.current);
    if (!q.trim()) {
      setUserResults([]);
      userSubRef.current?.unsubscribe();
      setUserSearchLoading(false);
      return;
    }
    userDebounceRef.current = setTimeout(() => runUserSearch(q.trim()), SUGGEST_DEBOUNCE_MS);
  };

  const handleUserSearchClear = () => {
    clearTimeout(userDebounceRef.current);
    userAbortRef.current?.abort();
    userSubRef.current?.unsubscribe();
    setUserQuery(""); setUserResults([]); setUserSearchLoading(false);
  };

  useEffect(() => () => {
    clearTimeout(userDebounceRef.current);
    userAbortRef.current?.abort();
    userSubRef.current?.unsubscribe();
  }, []);

  const submitHashtag = () => {
    const val = hashtagInput.trim().replace(/^#/, "");
    if (!val) return;
    onMuteHashtag?.(val);
    setHashtagInput("");
    hashtagInputRef.current?.focus();
  };

  const submitWord = () => {
    const val = wordInput.trim();
    if (!val) return;
    onMuteWord?.(val);
    setWordInput("");
    wordInputRef.current?.focus();
  };

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <span className="feed-title">Muted</span>
      </div>

      {/* Tab bar */}
      <div className="profile-stats" style={{ borderBottom: "1px solid var(--border)" }}>
        {TABS.map(t => (
          <div
            key={t.id}
            className={`profile-stat ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <div className="profile-stat-label">{t.label}</div>
          </div>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <div>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
            <div className="search-bar">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, color: "var(--text-faint)" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="search-input"
                placeholder="Search people to mute…"
                value={userQuery}
                onChange={handleUserSearchInput}
              />
              {userQuery && (
                <button type="button" className="search-clear" onClick={handleUserSearchClear}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {userQuery.trim() ? (
            <div>
              {userSearchLoading && <Spinner />}
              {!userSearchLoading && userResults.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-title">No results</div>
                  <div className="empty-state-sub">Try a different search term</div>
                </div>
              )}
              {!userSearchLoading && userResults.map(ev => (
                <UserSearchResult
                  key={ev.pubkey}
                  ev={ev}
                  isMuted={mutes.includes(ev.pubkey)}
                  onMute={onMuteUser}
                  onOpenProfile={onOpenProfile}
                />
              ))}
            </div>
          ) : mutes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No muted users</div>
              <div className="empty-state-sub">Users you mute will appear here</div>
            </div>
          ) : (
            mutes.map(pk => {
              const name = displayName(pk, profiles);
              return (
                <div key={pk} className="list-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
                  <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => onOpenProfile?.(pk)}>
                    <Avatar pk={pk} profiles={profiles} size={40} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onOpenProfile?.(pk)}>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{shortNpub(pk)}</div>
                  </div>
                  <button type="button" className="profile-follow-btn" style={{ flexShrink: 0 }} onClick={() => onUnmute?.(pk)}>
                    Unmute
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Hashtags tab */}
      {tab === "hashtags" && (
        <div>
          <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
            <input
              ref={hashtagInputRef}
              type="text"
              value={hashtagInput}
              onChange={e => setHashtagInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitHashtag()}
              placeholder="Add a hashtag…"
              style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", color: "var(--text)", outline: "none" }}
            />
            <button type="button" className="profile-follow-btn" onClick={submitHashtag}>Mute</button>
          </div>
          {hashtags.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No muted hashtags</div>
              <div className="empty-state-sub">Hashtags you mute will appear here</div>
            </div>
          ) : (
            hashtags.map(tag => (
              <div key={tag} className="list-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", fontWeight: 600, color: "var(--primary)" }}>#{tag}</span>
                </div>
                <button type="button" className="profile-follow-btn" style={{ flexShrink: 0 }} onClick={() => onUnmuteHashtag?.(tag)}>
                  Unmute
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Words tab */}
      {tab === "words" && (
        <div>
          <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
            <input
              ref={wordInputRef}
              type="text"
              value={wordInput}
              onChange={e => setWordInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitWord()}
              placeholder="Add a word or phrase…"
              style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", color: "var(--text)", outline: "none" }}
            />
            <button type="button" className="profile-follow-btn" onClick={submitWord}>Mute</button>
          </div>
          {words.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No muted words</div>
              <div className="empty-state-sub">Words you mute will appear here</div>
            </div>
          ) : (
            words.map(word => (
              <div key={word} className="list-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", fontWeight: 500, color: "var(--text)" }}>{word}</span>
                </div>
                <button type="button" className="profile-follow-btn" style={{ flexShrink: 0 }} onClick={() => onUnmuteWord?.(word)}>
                  Unmute
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Threads tab */}
      {tab === "threads" && (
        threads.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No muted threads</div>
            <div className="empty-state-sub">Threads you mute will appear here</div>
          </div>
        ) : (
          <div>
            {threads.map(id => (
              <div key={id} className="list-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)", wordBreak: "break-all" }}>{id}</span>
                </div>
                <button type="button" className="profile-follow-btn" style={{ flexShrink: 0 }} onClick={() => onUnmuteThread?.(id)}>
                  Unmute
                </button>
              </div>
            ))}
          </div>
        )
      )}

    </div>
  );
}
