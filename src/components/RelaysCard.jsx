import { useState, useEffect } from "react";
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

export default function RelaysCard({ profilePubkey, pubkey, activeNav }) {
  const [poolRelays, setPoolRelays] = useState(() => [...pool.relays.keys()]);
  const { inboxes } = useMailboxes(profilePubkey ?? null);
  const configuredSearchRelays = useSearchRelays(activeNav === "search" ? pubkey : null);
  const searchRelays = configuredSearchRelays.length > 0 ? configuredSearchRelays.map(r => r.url) : DEFAULT_SEARCH_RELAYS;

  // Keep pool relay list current when not viewing a profile or search
  useEffect(() => {
    if (profilePubkey || activeNav === "search") return;
    const id = setInterval(() => setPoolRelays([...pool.relays.keys()]), 2000);
    return () => clearInterval(id);
  }, [profilePubkey, activeNav]);

  const relays = (
    activeNav === "search" ? searchRelays :
    profilePubkey ? inboxes :
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
        <div className="relay-item" key={i}>
          {fmtUrl(r)}
        </div>
      ))}
    </div>
  );
}
