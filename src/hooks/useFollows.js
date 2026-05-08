import { useState, useEffect } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

export default function useFollows({ pubkey }) {
  const [follows, setFollows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isHexPubkey(pubkey)) return;
    setLoading(true);

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    let latest = { created_at: 0 };

    const sub = pool.request(relayUrls, [{ kinds: [3], authors: [pubkey], limit: 1 }]).subscribe({
      next: raw => {
        eventStore.add(raw);
        if ((raw.created_at || 0) <= (latest.created_at || 0)) return;
        latest = raw;
        const pks = raw.tags
          .filter(t => t[0] === "p")
          .map(t => normPubkey(t[1]))
          .filter(isHexPubkey);
        if (pks.length) setFollows(pks);
      },
      complete: () => setLoading(false),
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [pubkey]);

  return { follows, loading };
}
