import { useState, useEffect, useRef, useMemo } from "react";
import Avatar from "./Avatar.jsx";
import { displayName, isHexPubkey, normPubkey } from "../utils.js";
import { eventStore } from "../nostr.js";
import useProfiles from "../hooks/useProfiles.js";

export default function ParticipantsCard({ event, profiles: propProfiles, onOpenProfile }) {
  const [pubkeys, setPubkeys] = useState([]);
  const seenRef = useRef(new Set());

  useEffect(() => {
    if (!event?.id) { setPubkeys([]); return; }

    const seen = new Set();
    seenRef.current = seen;

    const add = pk => {
      const k = normPubkey(pk);
      if (!k || !isHexPubkey(k) || seen.has(k)) return null;
      seen.add(k);
      return k;
    };

    // Seed with the focused note's author
    const initial = [add(event.pubkey)].filter(Boolean);

    // Collect any replies already in the store (e.g. revisiting a cached thread)
    const existing = eventStore.getTimeline([{ kinds: [1], "#e": [event.id] }]);
    for (const ev of existing) {
      const k = add(ev.pubkey);
      if (k) initial.push(k);
    }

    setPubkeys(initial);

    // Catch replies that arrive from the network after mount (ThreadView feeds these in)
    const sub = eventStore.insert$.subscribe(ev => {
      if (ev.kind !== 1) return;
      if (!ev.tags?.some(t => t[0] === "e" && t[1] === event.id)) return;
      const k = normPubkey(ev.pubkey);
      if (!k || !isHexPubkey(k) || seenRef.current.has(k)) return;
      seenRef.current.add(k);
      setPubkeys(prev => [...prev, k]);
    });

    return () => sub.unsubscribe();
  }, [event?.id]);

  const { profiles: localProfiles } = useProfiles({ pubkeys });
  const profiles = useMemo(() => ({ ...propProfiles, ...localProfiles }), [propProfiles, localProfiles]);

  if (pubkeys.length === 0) return null;

  return (
    <div className="panel-card">
      <div className="panel-title">Participants</div>
      {pubkeys.map(pk => (
        <div
          key={pk}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", cursor: "pointer" }}
          onClick={() => onOpenProfile?.(pk)}
          role="button"
        >
          <Avatar pk={pk} profiles={profiles} size={20} />
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "calc(var(--font-base) - 1px)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName(pk, profiles)}
          </span>
        </div>
      ))}
    </div>
  );
}
