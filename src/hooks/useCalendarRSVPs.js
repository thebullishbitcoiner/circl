import { useState, useEffect, useRef } from "react";
import { pool } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";
import { getRSVPStatus } from "applesauce-common/helpers/calendar-rsvp";

export default function useCalendarRSVPs({ event, pubkey }) {
  const [rsvps, setRsvps] = useState([]);
  const [loading, setLoading] = useState(false);
  const seen = useRef(new Set());

  useEffect(() => {
    if (!event?.kind || !event?.pubkey) return;
    const d = event.tags?.find(t => t[0] === "d")?.[1] ?? "";
    const addr = `${event.kind}:${event.pubkey}:${d}`;
    setLoading(true);

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
    const sub = pool.subscription(relayUrls, [{ kinds: [31925], "#a": [addr] }]).subscribe({
      next: raw => {
        if (seen.current.has(raw.id)) return;
        seen.current.add(raw.id);
        setRsvps(prev => {
          // Replace any prior RSVP from the same pubkey (latest wins)
          const filtered = prev.filter(r => r.pubkey !== raw.pubkey);
          return [...filtered, raw];
        });
        setLoading(false);
      },
    });

    const t = setTimeout(() => setLoading(false), 8000);
    return () => { clearTimeout(t); sub.unsubscribe(); };
  }, [event?.id]);

  const grouped = { accepted: [], declined: [], tentative: [] };
  for (const r of rsvps) {
    const s = getRSVPStatus(r);
    if (s) grouped[s].push(r.pubkey);
  }
  const counts = { accepted: grouped.accepted.length, declined: grouped.declined.length, tentative: grouped.tentative.length };

  const myRsvpEvent = pubkey ? rsvps.find(r => r.pubkey === pubkey) : undefined;
  const myRsvp = myRsvpEvent ? getRSVPStatus(myRsvpEvent) ?? null : null;

  return { counts, grouped, myRsvp, loading };
}
