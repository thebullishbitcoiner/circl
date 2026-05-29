import { useState, useEffect, useMemo } from "react";
import { isHexPubkey, normPubkey, nip19 } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

const PRIORITY_COUNT = 16; // self + first 15 feed authors
const REST_DELAY_MS = 600;

// Module-scope: pubkeys marked here are never re-fetched on remount
const _fetched = new Set();

// Module-scope: pending "rest" pubkeys batch, debounced
const _pendingRest = new Set();
let _restTimer = null;

function pubkeysToKey(pubkeys) {
  const seen = new Set();
  const out = [];
  for (const pk of pubkeys || []) {
    const n = normPubkey(pk);
    if (isHexPubkey(n) && !seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out.join(",");
}

function normalizeProfilePubkey(pk) {
  const n = normPubkey(pk);
  if (isHexPubkey(n)) return n;
  if (typeof n === "string" && n.startsWith("npub1")) {
    try {
      const d = nip19.decode(n);
      if (d?.type === "npub" && isHexPubkey(d.data)) return normPubkey(d.data);
    } catch {}
  }
  return null;
}

/** Read a profile synchronously from EventStore's ReplaySubject(1) model. */
function profileFromStore(pk) {
  let val;
  const sub = eventStore.profile(pk).subscribe(v => { val = v; });
  sub.unsubscribe();
  return val;
}

function toProfileShape(k, data) {
  if (!data) return null;
  return {
    name: data.display_name || data.preferred_name || data.name || k.slice(0, 8),
    display_name: data.display_name || data.preferred_name || null,
    preferred_name: data.preferred_name || null,
    picture: data.picture ?? null,
    about: data.about ?? data.description ?? data.bio ?? "",
    nip05: data.nip05 ?? null,
    lud16: data.lud16 ?? null,
    lud06: data.lud06 ?? null,
    website: data.website ?? data.url ?? null,
    banner: data.banner ?? data.cover ?? data.header ?? null,
  };
}

function fetchBatch(pubkeys) {
  if (!pubkeys.length) return;
  const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
  pool.request(relayUrls, [{ kinds: [0], authors: pubkeys }]).subscribe({
    next: event => eventStore.add(event), // triggers insert$ → updates profiles reactively
  });
}

function flushRest() {
  _restTimer = null;
  if (_pendingRest.size) {
    fetchBatch([..._pendingRest]);
    _pendingRest.clear();
  }
}

export default function useProfiles({ pubkeys }) {
  const pubkeysKey = useMemo(() => pubkeysToKey(pubkeys), [pubkeys]);

  // Initialize synchronously from EventStore — avoids npub flash on remounts
  const [profiles, setProfiles] = useState(() => {
    const initial = {};
    for (const pk of pubkeysKey.split(",").filter(Boolean)) {
      const k = normalizeProfilePubkey(pk);
      if (!k) continue;
      const content = profileFromStore(k);
      if (content) initial[k] = toProfileShape(k, content);
    }
    return initial;
  });

  // Reactive updates: when any kind-0 is added to EventStore, update state
  useEffect(() => {
    const sub = eventStore.insert$.subscribe(event => {
      if (event.kind !== 0) return;
      const k = normalizeProfilePubkey(event.pubkey);
      if (!k) return;
      const content = profileFromStore(k);
      if (!content) return;
      setProfiles(prev => ({ ...prev, [k]: toProfileShape(k, content) }));
    });
    return () => sub.unsubscribe();
  }, []);

  // When pubkeys list changes: sync cached profiles from EventStore + fetch missing ones
  useEffect(() => {
    if (!pubkeysKey) return;
    const list = pubkeysKey.split(",").filter(Boolean);

    // First pass: populate any newly visible pubkeys from EventStore cache (no relay needed)
    const fromStore = {};
    for (const pk of list) {
      const k = normalizeProfilePubkey(pk);
      if (!k) continue;
      const content = profileFromStore(k);
      if (content) fromStore[k] = toProfileShape(k, content);
    }
    if (Object.keys(fromStore).length > 0) {
      setProfiles(prev => ({ ...fromStore, ...prev }));
    }

    // Second pass: fetch pubkeys not yet fetched from relays
    // Priority profiles (first PRIORITY_COUNT by allPks order) → immediate, no debounce
    // Rest → batched with debounce that only resets when NEW pubkeys appear
    const priorityNew = [];

    for (let i = 0; i < list.length; i++) {
      const k = normalizeProfilePubkey(list[i]);
      if (!k || _fetched.has(k)) continue;
      _fetched.add(k);

      if (i < PRIORITY_COUNT) {
        priorityNew.push(k);
      } else {
        _pendingRest.add(k);
        // Schedule (or reschedule) the rest batch
        if (_restTimer) clearTimeout(_restTimer);
        _restTimer = setTimeout(flushRest, REST_DELAY_MS);
      }
    }

    if (priorityNew.length) fetchBatch(priorityNew);
  }, [pubkeysKey]);

  return { profiles };
}
