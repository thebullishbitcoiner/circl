import { useState, useEffect } from "react";
import useMailboxes from "../hooks/useMailboxes.js";
import { pool } from "../nostr.js";

const fmtUrl = url => url.replace(/^wss?:\/\//, "").replace(/\/$/, "");

export default function RelaysCard({ profilePubkey }) {
  const [poolRelays, setPoolRelays] = useState(() => [...pool.relays.keys()]);
  const { inboxes } = useMailboxes(profilePubkey ?? null);

  // Keep pool relay list current when not viewing a profile
  useEffect(() => {
    if (profilePubkey) return;
    const id = setInterval(() => setPoolRelays([...pool.relays.keys()]), 2000);
    return () => clearInterval(id);
  }, [profilePubkey]);

  const relays = profilePubkey ? inboxes : poolRelays;

  return (
    <div className="panel-card">
      <div className="panel-title">Relays</div>
      {relays.length === 0 && (
        <div style={{ fontSize: "calc(var(--font-base) - 3px)", color: "var(--text-faint)", fontFamily: "monospace" }}>
          {profilePubkey ? "No relay list" : "Connecting..."}
        </div>
      )}
      {relays.map((r, i) => (
        <div className="relay-item" key={i}>
          <div className="relay-dot" />
          {fmtUrl(r)}
        </div>
      ))}
    </div>
  );
}
