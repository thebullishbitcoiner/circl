import { useState, useEffect, useRef, useCallback } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";

// Allow-list size the filter must reach before it activates. Below this the
// graph is still building (new user / onboarding) so nothing is filtered.
const THRESHOLD = 1000;
const STALE_MS = 1000 * 60 * 60 * 12;
const CHUNK = 100;
const FETCH_TIMEOUT = 12000;

const cacheKey = pk => `circl_wot_${pk}`;
function readCache(pk) {
  try { return JSON.parse(localStorage.getItem(cacheKey(pk)) || "null"); } catch { return null; }
}
function writeCache(pk, pubkeys, updatedAt) {
  try { localStorage.setItem(cacheKey(pk), JSON.stringify({ pubkeys, updatedAt })); } catch {}
}

// Fetch kind-3 contact lists for `authors`, returning pubkey -> [followed pubkeys]
// (latest replaceable event per author).
function fetchKind3(authors, relayUrls) {
  return new Promise(resolve => {
    const out = new Map(); // pubkey -> { at, ps }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sub.unsubscribe();
      const m = new Map();
      for (const [k, v] of out) m.set(k, v.ps);
      resolve(m);
    };
    const sub = pool.request(relayUrls, [{ kinds: [3], authors }]).subscribe({
      next: raw => {
        if (raw.kind !== 3) return;
        const pk = normPubkey(raw.pubkey);
        const prev = out.get(pk);
        if (prev && prev.at >= raw.created_at) return;
        const ps = raw.tags
          .filter(t => t[0] === "p" && isHexPubkey(normPubkey(t[1])))
          .map(t => normPubkey(t[1]));
        out.set(pk, { at: raw.created_at, ps });
      },
      complete: finish,
      error: finish,
    });
    const timer = setTimeout(finish, FETCH_TIMEOUT);
  });
}

/**
 * Web of Trust: your follows ∪ follows-of-follows (skipping follow lists larger
 * than the Dunbar threshold). Used to keep bot replies/notifications out of view.
 * Client-side, cached, non-blocking; the raw per-follow lists live in memory so
 * the Dunbar slider can recompute without a refetch (a fresh session refetches).
 */
export default function useWebOfTrust({ myPubkey, follows, enabled = true, dunbar = 250, mainAccount = null }) {
  const me = isHexPubkey(myPubkey) ? normPubkey(myPubkey) : null;
  const mainPubkey = (mainAccount && isHexPubkey(mainAccount)) ? normPubkey(mainAccount) : me;

  const [trusted, setTrusted] = useState(() => new Set());
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updating, setUpdating] = useState(false);

  const rawListsRef = useRef(new Map());   // followed pubkey -> [their follows]
  const mainFollowsRef = useRef([]);       // main account's own follows
  const dunbarRef = useRef(dunbar);
  const updatingRef = useRef(false);
  useEffect(() => { dunbarRef.current = dunbar; }, [dunbar]);

  const recompute = useCallback(() => {
    if (!mainPubkey) { setTrusted(new Set()); return null; }
    const d = dunbarRef.current;
    const s = new Set([mainPubkey]);
    if (me) s.add(me);
    for (const pk of mainFollowsRef.current) s.add(pk);
    for (const list of rawListsRef.current.values()) {
      if (d === 0 || list.length <= d) for (const pk of list) s.add(pk);
    }
    setTrusted(s);
    return s;
  }, [mainPubkey, me]);

  // Seed from the persisted snapshot on account change.
  useEffect(() => {
    rawListsRef.current = new Map();
    mainFollowsRef.current = [];
    if (!mainPubkey) { setTrusted(new Set()); setUpdatedAt(null); return; }
    const cached = readCache(mainPubkey);
    const s = new Set(cached?.pubkeys || []);
    s.add(mainPubkey);
    if (me) s.add(me);
    setTrusted(s);
    setUpdatedAt(cached?.updatedAt || null);
  }, [mainPubkey, me]);

  const build = useCallback(async ({ force = false } = {}) => {
    if (!enabled || !mainPubkey || updatingRef.current) return;
    updatingRef.current = true;
    setUpdating(true);
    try {
      const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;

      let mainFollows;
      if (mainPubkey === me && follows?.length) {
        mainFollows = follows.filter(isHexPubkey).map(normPubkey);
      } else {
        mainFollows = (await fetchKind3([mainPubkey], relayUrls)).get(mainPubkey) || [];
      }
      mainFollowsRef.current = mainFollows;
      if (mainFollows.length < 5) return; // still onboarding — leave the filter inert

      const need = force ? mainFollows : mainFollows.filter(pk => !rawListsRef.current.has(pk));
      for (let i = 0; i < need.length; i += CHUNK) {
        const chunk = need.slice(i, i + CHUNK);
        const m = await fetchKind3(chunk, relayUrls);
        for (const pk of chunk) rawListsRef.current.set(pk, m.get(pk) || []);
      }

      const s = recompute();
      if (s) { writeCache(mainPubkey, [...s], Date.now()); setUpdatedAt(Date.now()); }
    } finally {
      updatingRef.current = false;
      setUpdating(false);
    }
  }, [enabled, mainPubkey, me, follows, recompute]);

  // Auto-build when enabled and the snapshot is missing or stale.
  useEffect(() => {
    if (!enabled || !mainPubkey) return;
    const t = setTimeout(() => {
      const cached = readCache(mainPubkey);
      const stale = !cached?.updatedAt || (Date.now() - cached.updatedAt) > STALE_MS;
      if (stale || !cached?.pubkeys?.length) build();
    }, 1500);
    return () => clearTimeout(t);
  }, [enabled, mainPubkey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced rebuild when the logged-in user's own follow list changes.
  const followsLen = (follows || []).length;
  useEffect(() => {
    if (!enabled || !mainPubkey || mainPubkey !== me) return;
    const t = setTimeout(() => build({ force: true }), 8000);
    return () => clearTimeout(t);
  }, [followsLen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dunbar change: recompute from the in-memory lists, or refetch if this session
  // has none yet (the persisted snapshot is already flattened past the old value).
  const dunbarInit = useRef(true);
  useEffect(() => {
    if (dunbarInit.current) { dunbarInit.current = false; return; }
    if (!enabled || !mainPubkey) return;
    if (rawListsRef.current.size > 0) {
      const s = recompute();
      if (s) writeCache(mainPubkey, [...s], Date.now());
      setUpdatedAt(Date.now());
    } else {
      build({ force: true });
    }
  }, [dunbar]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = trusted.size;
  const wotActive = enabled && !!mainPubkey && count >= THRESHOLD;

  const isTrusted = useCallback(
    pk => (pk ? trusted.has(normPubkey(pk)) : false),
    [trusted]
  );

  return {
    isTrusted,
    wotActive,
    count,
    updatedAt,
    updating,
    mainPubkey,
    refresh: () => build({ force: true }),
  };
}
