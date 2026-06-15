import { useState, useEffect, useCallback } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

export default function useFollows({ pubkey, signAndPublish }) {
  const [follows, setFollows] = useState([]);
  const [rawEvent, setRawEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

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
  }, [pubkey, refreshKey]);

  const unfollow = useCallback(async targetPk => {
    if (!signAndPublish || !rawEvent) return;
    const norm = normPubkey(targetPk);
    const newTags = rawEvent.tags.filter(t => !(t[0] === "p" && normPubkey(t[1]) === norm));
    // Optimistic update
    setFollows(prev => prev.filter(pk => pk !== norm));
    setRawEvent(prev => ({ ...prev, tags: newTags }));
    const ev = await signAndPublish({ kind: 3, tags: newTags, content: rawEvent.content ?? "" });
    if (!ev) {
      // Revert on failure
      setFollows(prev => prev.includes(norm) ? prev : [...prev, norm]);
      setRawEvent(prev => rawEvent);
    }
  }, [rawEvent, signAndPublish]);

  const follow = useCallback(async targetPk => {
    if (!signAndPublish) return;
    const norm = normPubkey(targetPk);
    const baseTags = rawEvent?.tags ?? [];
    if (baseTags.some(t => t[0] === "p" && normPubkey(t[1]) === norm)) return;
    const newTags = [...baseTags, ["p", norm]];
    // Optimistic update
    setFollows(prev => prev.includes(norm) ? prev : [...prev, norm]);
    setRawEvent(prev => prev ? { ...prev, tags: newTags } : { tags: newTags, content: "" });
    const ev = await signAndPublish({ kind: 3, tags: newTags, content: rawEvent?.content ?? "" });
    if (!ev) {
      // Revert on failure
      setFollows(prev => prev.filter(pk => pk !== norm));
      setRawEvent(prev => rawEvent);
    }
  }, [rawEvent, signAndPublish]);

  return { follows, loading, follow, unfollow, refresh };
}
