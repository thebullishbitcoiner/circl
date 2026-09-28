import { useState, useEffect, useCallback } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore, relayUrls$ } from "../nostr.js";

// Last-known follow list per account, seeded synchronously so the feed can
// start fetching immediately on load instead of waiting on a relay round-trip
// for the user's own kind:3 every single time (mirrors the profile cache in
// nostr.js). The live fetch below still runs and corrects this if it's stale.
const CACHE_KEY = "circl_follows_cache_v1";

function readCache(pk) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    return all[pk] || null; // { follows: string[], rawEvent } | null
  } catch { return null; }
}
function writeCache(pk, follows, rawEvent) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    all[pk] = { follows, rawEvent };
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {}
}

export default function useFollows({ pubkey, signAndPublish }) {
  const [follows, setFollows] = useState(() => (isHexPubkey(pubkey) ? readCache(pubkey)?.follows : null) ?? []);
  const [rawEvent, setRawEvent] = useState(() => (isHexPubkey(pubkey) ? readCache(pubkey)?.rawEvent : null) ?? null);
  // App mounts once with pubkey still null (before session restore/login
  // resolves), so an initializer keyed off pubkey/cache here would just
  // capture that stale null forever — it only runs at true mount, not on
  // every prop change. Defaulting to true and only clearing it once the
  // effect below actually resolves for the current pubkey avoids a
  // "loaded and empty" flash on every load while that catches up.
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (!isHexPubkey(pubkey)) { setLoading(false); return; }
    setLoading(true);

    const cached = readCache(pubkey);
    if (cached?.follows?.length) {
      setFollows(cached.follows);
      setRawEvent(cached.rawEvent ?? null);
    }

    let latest = { created_at: cached?.rawEvent?.created_at || 0 };

    const sub = pool.group(relayUrls$, false).request([{ kinds: [3], authors: [pubkey], limit: 1 }]).subscribe({
      next: raw => {
        if (raw.kind !== 3) return;
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
          writeCache(pubkey, pks, raw);
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
    } else if (isHexPubkey(pubkey)) {
      writeCache(pubkey, newTags.filter(t => t[0] === "p").map(t => normPubkey(t[1])).filter(isHexPubkey), ev);
    }
  }, [rawEvent, signAndPublish, pubkey]);

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
    } else if (isHexPubkey(pubkey)) {
      writeCache(pubkey, newTags.filter(t => t[0] === "p").map(t => normPubkey(t[1])).filter(isHexPubkey), ev);
    }
  }, [rawEvent, signAndPublish, pubkey]);

  return { follows, loading, follow, unfollow, refresh };
}
