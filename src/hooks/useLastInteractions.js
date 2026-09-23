import { useState, useEffect, useRef, useMemo } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";

const FETCH_CHUNK_SIZE = 50; // relay filter size limit, matches useProfiles.js

// Persists across mounts — `${myPubkey}:${contactPubkey}` → last kind-1 created_at (or null if none found)
const _cache = new Map();

export default function useLastInteractions({ myPubkey, pubkeys = [], active = false }) {
  const [lastInteraction, setLastInteraction] = useState({});
  const stateRef = useRef({});

  // Stable key so an effect doesn't refire just because the parent passed a new array
  // reference with the same contents (mirrors useProfiles.js's pubkeysKey pattern).
  const contactsKey = useMemo(
    () => [...new Set((pubkeys || []).map(normPubkey).filter(isHexPubkey))].join(","),
    [pubkeys]
  );

  useEffect(() => {
    if (!active) return;
    const me = normPubkey(myPubkey);
    if (!isHexPubkey(me)) return;

    const contacts = contactsKey ? contactsKey.split(",") : [];
    if (!contacts.length) return;

    // Seed from cache, split out contacts we've never fetched for this `me`
    const initial = {};
    const toFetch = [];
    for (const pk of contacts) {
      const key = `${me}:${pk}`;
      if (_cache.has(key)) {
        const ts = _cache.get(key);
        if (ts) initial[pk] = ts;
      } else {
        toFetch.push(pk);
      }
    }
    stateRef.current = initial;
    setLastInteraction(initial);
    if (!toFetch.length) return;

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
    const subs = [];

    for (let i = 0; i < toFetch.length; i += FETCH_CHUNK_SIZE) {
      const chunk = toFetch.slice(i, i + FETCH_CHUNK_SIZE);
      const chunkSet = new Set(chunk);
      let pending = 2;

      const onEvent = raw => {
        eventStore.add(raw);
        let changed = false;
        const bump = pk => {
          if (!chunkSet.has(pk)) return;
          const key = `${me}:${pk}`;
          const prev = _cache.get(key) || 0;
          if (raw.created_at > prev) {
            _cache.set(key, raw.created_at);
            stateRef.current = { ...stateRef.current, [pk]: raw.created_at };
            changed = true;
          }
        };
        if (raw.pubkey === me) {
          for (const tag of raw.tags) if (tag[0] === "p") bump(tag[1]);
        } else {
          bump(raw.pubkey);
        }
        if (changed) setLastInteraction(stateRef.current);
      };

      const onDone = () => {
        pending -= 1;
        if (pending > 0) return;
        for (const pk of chunk) {
          const key = `${me}:${pk}`;
          if (!_cache.has(key)) _cache.set(key, null);
        }
      };

      subs.push(pool.request(relayUrls, [
        { kinds: [1], authors: [me], "#p": chunk, limit: chunk.length * 20 },
      ]).subscribe({ next: onEvent, complete: onDone, error: onDone }));

      subs.push(pool.request(relayUrls, [
        { kinds: [1], authors: chunk, "#p": [me], limit: chunk.length * 20 },
      ]).subscribe({ next: onEvent, complete: onDone, error: onDone }));
    }

    return () => subs.forEach(s => s.unsubscribe());
  }, [myPubkey, contactsKey, active]);

  return { lastInteraction };
}
