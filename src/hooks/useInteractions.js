import { useState, useEffect, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

export default function useInteractions({ ndk, myPubkey, otherPubkey, feedEvents }) {
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(false);
  const seen = useRef(new Set());

  useEffect(() => {
    const me = normPubkey(myPubkey);
    const them = normPubkey(otherPubkey);
    if (!isHexPubkey(me) || !isHexPubkey(them)) return;

    setExtras([]);
    seen.current.clear();
    setLoading(true);
    feedEvents.forEach(e => seen.current.add(e.id));

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;

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
        setExtras(prev => [...prev, raw].sort((a, b) => a.created_at - b.created_at));
      },
      complete: () => setLoading(false),
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [myPubkey, otherPubkey]);

  return { extras, loading };
}
