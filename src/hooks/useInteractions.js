import { useState, useEffect, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

// Persists across mounts — revisiting the same profile pair skips the relay fetch
const _cache = new Map(); // `${myPubkey}:${otherPubkey}` → extras[]

export default function useInteractions({ myPubkey, otherPubkey, feedEvents }) {
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(false);
  const seen = useRef(new Set());

  useEffect(() => {
    const me = normPubkey(myPubkey);
    const them = normPubkey(otherPubkey);
    if (!isHexPubkey(me) || !isHexPubkey(them)) return;

    seen.current.clear();
    feedEvents.forEach(e => seen.current.add(e.id));

    const cacheKey = `${me}:${them}`;
    const cached = _cache.get(cacheKey);
    if (cached) {
      setExtras(cached);
      setLoading(false);
      return;
    }

    setExtras([]);
    setLoading(true);

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    const collected = [];

    const sub = pool.request(
      relayUrls,
      [
        { kinds: [1], authors: [them], "#p": [me], limit: 100 },
        { kinds: [1], authors: [me], "#p": [them], limit: 100 },
      ]
    ).subscribe({
      next: raw => {
        eventStore.add(raw);
        if (seen.current.has(raw.id)) return;
        seen.current.add(raw.id);
        collected.push(raw);
        setExtras([...collected].sort((a, b) => a.created_at - b.created_at));
      },
      complete: () => {
        _cache.set(cacheKey, [...collected].sort((a, b) => a.created_at - b.created_at));
        setLoading(false);
      },
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [myPubkey, otherPubkey]);

  return { extras, loading };
}
