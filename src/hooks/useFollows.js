import { useState, useEffect, useCallback, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore, relayUrls$ } from "../nostr.js";

const FOLLOW_LIST_KIND = 3;
const CACHE_KEY = "circl_follows";
// How long relays get to answer before an empty result is read as "this account
// really has no follow list" instead of "we haven't heard back yet".
const SETTLE_MS = 8000;

function readCache(pk) {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY))?.[pk] ?? null; } catch { return null; }
}
function writeCache(pk, baseline) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
    store[pk] = baseline;
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}

const followsFromTags = tags =>
  (tags || []).filter(t => t[0] === "p").map(t => normPubkey(t[1])).filter(isHexPubkey);

// Some clients emit the same pubkey twice; count distinct follows so a dedupe
// in the source list doesn't look like an unexpected removal.
const distinctFollowCount = tags => new Set(followsFromTags(tags)).size;

export default function useFollows({ pubkey, signAndPublish }) {
  const pk0 = normPubkey(pubkey);
  const cached0 = isHexPubkey(pk0) ? readCache(pk0) : null;

  const [follows, setFollows] = useState(() => followsFromTags(cached0?.tags));
  const [loading, setLoading] = useState(!cached0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Kind 3 is replaceable, so publishing one doesn't merge — it overwrites the
  // copy on every relay. Each publish is therefore built from `baselineRef`,
  // the newest kind 3 we have actually seen (relay-loaded, or restored from
  // cache on a cold start), never from whatever `follows` holds at the time.
  const baselineRef = useRef(cached0);
  const baselinePkRef = useRef(pk0);
  // Until relays have answered, a missing baseline is indistinguishable from an
  // empty one, and publishing then would replace the stored list with a stub.
  const settledRef = useRef(!!cached0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    const pk = normPubkey(pubkey);

    // Account switch — nothing the previous account loaded may carry over.
    if (baselinePkRef.current !== pk) {
      baselinePkRef.current = pk;
      baselineRef.current = null;
      settledRef.current = false;
      setFollows([]);
    }
    if (!isHexPubkey(pk)) { setLoading(false); return; }

    let cancelled = false;

    // Only ever moves the baseline forward, so a relay replaying an older kind 3
    // can't roll the list back to a stale version.
    const adopt = (next, persistToCache) => {
      if (cancelled || (next.created_at ?? 0) <= (baselineRef.current?.created_at ?? 0)) return;
      baselineRef.current = next;
      settledRef.current = true;
      setFollows(followsFromTags(next.tags));
      setLoading(false);
      if (persistToCache) writeCache(pk, next);
    };

    const cached = readCache(pk);
    if (cached) adopt(cached, false);

    // Another view (own profile, web-of-trust) may already have put this
    // account's kind 3 in the store — a synchronous baseline beats waiting on
    // a relay round-trip, and shrinks the window where a follow has nothing to
    // build on.
    const stored = eventStore.getReplaceable(FOLLOW_LIST_KIND, pk);
    if (stored) adopt({ created_at: stored.created_at, tags: stored.tags ?? [], content: stored.content ?? "" }, true);

    setLoading(!baselineRef.current);

    // A long-lived subscription rather than a one-shot request: `request()`
    // completes ~5s after the first relay's EOSE, which can land before the
    // account's outbox relays finish connecting — making a user whose kind 3
    // only lives there look like they have no follow list at all.
    const sub = pool.group(relayUrls$, false).subscription([{ kinds: [FOLLOW_LIST_KIND], authors: [pk] }]).subscribe({
      next: raw => {
        if (cancelled || raw.kind !== FOLLOW_LIST_KIND || normPubkey(raw.pubkey) !== pk) return;
        eventStore.add(raw);
        adopt({ created_at: raw.created_at, tags: raw.tags ?? [], content: raw.content ?? "" }, true);
      },
      // A relay dropping out after it already delivered the list is routine and
      // must not unsettle a baseline that is already loaded.
      error: () => { if (!cancelled && !baselineRef.current) setLoading(false); },
    });

    const cutoffTimer = setTimeout(() => {
      sub.unsubscribe();
      if (cancelled) return;
      setLoading(false);
      // An empty answer only counts as a real answer if there was actually a
      // relay to ask; offline, we stay unsettled rather than assume no follows.
      if (pool.relays.size > 0) settledRef.current = true;
    }, SETTLE_MS);

    return () => {
      cancelled = true;
      clearTimeout(cutoffTimer);
      sub.unsubscribe();
    };
  }, [pubkey, refreshKey]);

  const persist = useCallback(async (nextTags, expectedCount) => {
    if (!signAndPublish) throw new Error("Sign in to update your follow list");
    if (!settledRef.current) throw new Error("Your follow list is still syncing from relays, please try again in a moment");
    // Backstop for the baseline invariant: the list going out must differ from
    // the one we hold by exactly the follow being added or removed.
    if (distinctFollowCount(nextTags) !== expectedCount) {
      throw new Error("Refusing to publish a follow list that doesn't match the requested change");
    }
    const signed = await signAndPublish({
      kind: FOLLOW_LIST_KIND,
      tags: nextTags,
      // Legacy kind 3 content carries a relay map for some accounts; dropping it
      // on an unrelated follow toggle would erase that too.
      content: baselineRef.current?.content ?? "",
    });
    const next = { created_at: signed.created_at, tags: signed.tags, content: signed.content ?? "" };
    baselineRef.current = next;
    settledRef.current = true;
    writeCache(normPubkey(pubkey), next);
    return signed;
  }, [signAndPublish, pubkey]);

  const follow = useCallback(async targetPk => {
    const norm = normPubkey(targetPk);
    if (!isHexPubkey(norm)) return;
    const baseTags = baselineRef.current?.tags ?? [];
    if (baseTags.some(t => t[0] === "p" && normPubkey(t[1]) === norm)) return;
    const expected = distinctFollowCount(baseTags) + 1;
    // Optimistic update
    setFollows(prev => prev.includes(norm) ? prev : [...prev, norm]);
    try {
      await persist([...baseTags, ["p", norm]], expected);
    } catch (e) {
      // Revert on failure
      setFollows(prev => prev.filter(pk => pk !== norm));
      throw e;
    }
  }, [persist]);

  const unfollow = useCallback(async targetPk => {
    const norm = normPubkey(targetPk);
    if (!isHexPubkey(norm)) return;
    const baseTags = baselineRef.current?.tags ?? [];
    const nextTags = baseTags.filter(t => !(t[0] === "p" && normPubkey(t[1]) === norm));
    if (nextTags.length === baseTags.length) return;
    const expected = distinctFollowCount(baseTags) - 1;
    // Optimistic update
    setFollows(prev => prev.filter(pk => pk !== norm));
    try {
      await persist(nextTags, expected);
    } catch (e) {
      // Revert on failure
      setFollows(prev => prev.includes(norm) ? prev : [...prev, norm]);
      throw e;
    }
  }, [persist]);

  return { follows, loading, follow, unfollow, refresh };
}
