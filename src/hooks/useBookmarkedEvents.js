import { useState, useEffect } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

function parseAddressTag(val) {
  if (typeof val !== "string") return null;
  const m = val.match(/^(\d+):([0-9a-fA-F]{64}):([\s\S]+)$/);
  if (!m) return null;
  const kind = parseInt(m[1], 10);
  const pk = normPubkey(m[2]);
  const d = m[3];
  if (!isHexPubkey(pk)) return null;
  return { kind, pubkey: pk, d };
}

export default function useBookmarkedEvents({ bookmarkTags, localEvents = [] }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bookmarkTags?.length) { setEvents([]); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);

    const localPool = (localEvents || []).filter(ev => ev?.id);
    const resolvedById = new Map(localPool.map(ev => [ev.id, ev]));
    const resolvedByAddr = new Map(
      localPool
        .filter(ev => ev?.kind === 30023)
        .flatMap(ev => {
          const d = ev.tags?.find(t => t[0] === "d")?.[1];
          const pk = normPubkey(ev.pubkey);
          if (!d || !isHexPubkey(pk)) return [];
          return [[`30023:${pk}:${d}`, ev]];
        })
    );

    const tags = bookmarkTags.filter(t => Array.isArray(t) && t.length >= 2);

    // Pre-populate from eventStore for events not in the feed pool
    for (const t of tags) {
      if (t[0] === "e" && t[1] && !resolvedById.has(t[1])) {
        const stored = eventStore.getTimeline({ ids: [t[1]] })[0];
        if (stored) resolvedById.set(t[1], stored);
      }
    }

    const missingE = [];
    const missingA = [];
    for (const t of tags) {
      if (t[0] === "e" && t[1] && !resolvedById.has(t[1])) {
        missingE.push(t[1]);
      } else if (t[0] === "a" && t[1]) {
        const addr = parseAddressTag(t[1]);
        if (addr?.kind === 30023 && !resolvedByAddr.has(t[1])) {
          missingA.push({ pubkey: addr.pubkey, d: addr.d });
        }
      }
    }

    // Iterate in reverse so most recently bookmarked (last tag) appears first
    const buildOrdered = () => {
      const seen = new Set();
      const result = [];
      for (const t of [...tags].reverse()) {
        let ev = null;
        if (t[0] === "e") ev = resolvedById.get(t[1]);
        else if (t[0] === "a") ev = resolvedByAddr.get(t[1]);
        if (ev?.id && !seen.has(ev.id)) {
          seen.add(ev.id);
          result.push(ev);
        }
      }
      return result;
    };

    if (!missingE.length && !missingA.length) {
      if (!cancelled) { setEvents(buildOrdered()); setLoading(false); }
      return;
    }

    const filters = [];
    if (missingE.length) filters.push({ ids: missingE });
    for (const { pubkey, d } of missingA) {
      filters.push({ kinds: [30023], authors: [pubkey], "#d": [d] });
    }

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;

    const sub = pool.request(relayUrls, filters).subscribe({
      next: raw => {
        eventStore.add(raw);
        resolvedById.set(raw.id, raw);
        if (raw.kind === 30023) {
          const d = raw.tags?.find(t => t[0] === "d")?.[1];
          const pk = normPubkey(raw.pubkey);
          if (d && isHexPubkey(pk)) resolvedByAddr.set(`30023:${pk}:${d}`, raw);
        }
      },
      complete: () => {
        if (cancelled) return;
        setEvents(buildOrdered());
        setLoading(false);
      },
      error: () => {
        if (cancelled) return;
        setEvents(buildOrdered());
        setLoading(false);
      },
    });

    return () => {
      cancelled = true;
      sub.unsubscribe();
    };
  }, [bookmarkTags, localEvents]);

  return { events, loading };
}
