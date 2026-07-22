import { useState, useEffect, useCallback } from "react";
import useMailboxes from "../hooks/useMailboxes.js";
import useSearchRelays from "../hooks/useSearchRelays.js";
import { pool } from "../nostr.js";

const DEFAULT_SEARCH_RELAYS = [
  "wss://relay.primal.net",
  "wss://search.nos.today",
  "wss://nostr.wine",
];

const isValidRelay = url => /^wss?:\/\/[^\s]+$/.test(url) && !/wss?:\/\//i.test(url.slice(6));
const fmtUrl = url => url.replace(/^wss?:\/\//, "").replace(/\/$/, "");

function relTime(ts) {
  if (!ts) return null;
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5)  return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function RelayTooltip({ url, rect, statusMap }) {
  const status = statusMap[url];
  const relay  = pool.relays.get(url);

  const label =
    !status          ? "Not in pool" :
    status.connected ? "Connected" :
    !status.ready    ? "Reconnecting…" :
                       "Disconnected";

  const activeSubs  = relay ? Object.keys(relay.reqs).length : 0;
  const lastMsg     = relay ? relTime(relay.lastMessageAt) : null;
  const attempts    = relay ? relay.attempts$.value : 0;
  const latestNotice = relay?.notices?.slice(-1)[0] ?? null;

  // Position to the left of the relay card, vertically aligned with the item
  const style = {
    position: "fixed",
    top: Math.min(rect.top, window.innerHeight - 160),
    right: window.innerWidth - rect.left + 8,
    zIndex: 9999,
    pointerEvents: "none",
  };

  return (
    <div className="relay-tooltip" style={style}>
      <div className="relay-tooltip-url">{fmtUrl(url)}</div>
      <div className={`relay-tooltip-row relay-tooltip-status--${status?.connected ? "on" : "off"}`}>
        {label}
      </div>
      {activeSubs > 0 && (
        <div className="relay-tooltip-row">
          {activeSubs} active sub{activeSubs !== 1 ? "s" : ""}
        </div>
      )}
      {lastMsg && (
        <div className="relay-tooltip-row relay-tooltip-faint">Last msg {lastMsg}</div>
      )}
      {attempts > 0 && (
        <div className="relay-tooltip-row relay-tooltip-faint">{attempts} reconnect{attempts !== 1 ? "s" : ""}</div>
      )}
      {status?.authenticated && (
        <div className="relay-tooltip-row relay-tooltip-faint">Authenticated</div>
      )}
      {status?.authRequiredForRead && !status?.authenticated && (
        <div className="relay-tooltip-row relay-tooltip-warn">Auth required</div>
      )}
      {latestNotice && (
        <div className="relay-tooltip-row relay-tooltip-notice">"{latestNotice}"</div>
      )}
    </div>
  );
}

export default function RelaysCard({ profilePubkey, pubkey, activeNav }) {
  const [poolRelays, setPoolRelays] = useState(() => [...pool.relays.keys()]);
  const [statusMap, setStatusMap] = useState(() => {
    const m = {};
    for (const [url, relay] of pool.relays) m[url] = { connected: relay.connected };
    return m;
  });
  const [tooltip, setTooltip] = useState(null); // { url, rect }

  const { outboxes } = useMailboxes(profilePubkey ?? null);
  const configuredSearchRelays = useSearchRelays(activeNav === "search" ? pubkey : null);
  const searchRelays = configuredSearchRelays.length > 0 ? configuredSearchRelays.map(r => r.url) : DEFAULT_SEARCH_RELAYS;

  // Subscribe to pool.status$ for live relay list + full status (replaces setInterval)
  useEffect(() => {
    const sub = pool.status$.subscribe(sm => {
      setPoolRelays(prev => {
        const all = new Set([...prev, ...Object.keys(sm)]);
        return [...all];
      });
      setStatusMap(sm);
    });
    return () => sub.unsubscribe();
  }, []);

  const handleMouseEnter = useCallback((e, url) => {
    setTooltip({ url, rect: e.currentTarget.getBoundingClientRect() });
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const relays = (
    activeNav === "search" ? searchRelays :
    profilePubkey ? outboxes :
    poolRelays
  ).filter(isValidRelay);

  const emptyLabel =
    activeNav === "search" ? "No search relays" :
    profilePubkey ? "No relay list" :
    "Connecting...";

  return (
    <div className="panel-card">
      <div className="panel-title">
        {activeNav === "search" ? "Search Relays" : "Relays"}
      </div>
      {relays.length === 0 && (
        <div style={{ fontSize: "calc(var(--font-base) - 3px)", color: "var(--text-faint)", fontFamily: "monospace" }}>
          {emptyLabel}
        </div>
      )}
      {relays.map((r, i) => (
        <div
          className="relay-item"
          key={i}
          onMouseEnter={e => handleMouseEnter(e, r)}
          onMouseLeave={handleMouseLeave}
        >
          <span className={`relay-dot ${statusMap[r]?.connected ? "relay-dot--connected" : "relay-dot--offline"}`} />
          {fmtUrl(r)}
        </div>
      ))}
      {tooltip && (
        <RelayTooltip url={tooltip.url} rect={tooltip.rect} statusMap={statusMap} />
      )}
    </div>
  );
}
