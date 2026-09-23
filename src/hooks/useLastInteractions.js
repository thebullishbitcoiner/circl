import { useState, useEffect, useRef, useMemo } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";

// Two filters per contact (my note to them, their note to me), each with its
// own limit:1 — so one prolific contact in a batch can't crowd a quieter
// contact's single (possibly old) interaction out of a shared result limit.
// Kept small since relays cap how many filters a single REQ may carry.
const CONTACTS_PER_REQUEST = 15;

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

    for (let i = 0; i < toFetch.length; i += CONTACTS_PER_REQUEST) {
      const group = toFetch.slice(i, i + CONTACTS_PER_REQUEST);
      const groupSet = new Set(group);
      const filters = [];
      for (const pk of group) {
        filters.push({ kinds: [1], authors: [me], "#p": [pk], limit: 1 });
        filters.push({ kinds: [1], authors: [pk], "#p": [me], limit: 1 });
      }

      const bump = (pk, createdAt) => {
        const key = `${me}:${pk}`;
        const prev = _cache.get(key) || 0;
        if (createdAt > prev) {
          _cache.set(key, createdAt);
          stateRef.current = { ...stateRef.current, [pk]: createdAt };
          return true;
        }
        return false;
      };

      const sub = pool.request(relayUrls, filters).subscribe({
        next: raw => {
          eventStore.add(raw);
          let changed = false;
          if (raw.pubkey === me) {
            for (const tag of raw.tags) {
              if (tag[0] === "p" && groupSet.has(tag[1]) && bump(tag[1], raw.created_at)) changed = true;
            }
          } else if (groupSet.has(raw.pubkey)) {
            changed = bump(raw.pubkey, raw.created_at);
          }
          if (changed) setLastInteraction(stateRef.current);
        },
        complete: () => {
          for (const pk of group) {
            const key = `${me}:${pk}`;
            if (!_cache.has(key)) _cache.set(key, null);
          }
        },
      });
      subs.push(sub);
    }

    return () => subs.forEach(s => s.unsubscribe());
  }, [myPubkey, contactsKey, active]);

  return { lastInteraction };
}
