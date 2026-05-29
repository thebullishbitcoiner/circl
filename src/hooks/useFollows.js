import { useState, useEffect, useCallback } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

export default function useFollows({ pubkey, signAndPublish }) {
  const [follows, setFollows] = useState([]);
  const [rawEvent, setRawEvent] = useState(null);
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
        if (pks.length) {
          setFollows(pks);
          setRawEvent(raw);
        }
      },
      complete: () => setLoading(false),
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [pubkey]);

  const unfollow = useCallback(async targetPk => {
    if (!signAndPublish || !rawEvent) return;
    const norm = normPubkey(targetPk);
    const newTags = rawEvent.tags.filter(t => !(t[0] === "p" && normPubkey(t[1]) === norm));
    const ev = await signAndPublish({ kind: 3, tags: newTags, content: rawEvent.content ?? "" });
    if (ev) {
      setFollows(prev => prev.filter(pk => pk !== norm));
      setRawEvent(prev => ({ ...prev, tags: newTags }));
    }
  }, [rawEvent, signAndPublish]);

  return { follows, loading, unfollow };
}
