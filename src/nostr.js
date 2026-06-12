import { EventStore } from "applesauce-core";
import { RelayPool } from "applesauce-relay";
import { createEventLoader } from "applesauce-loaders/loaders";
import { RELAYS } from "./constants.js";

export const eventStore = new EventStore();
export const pool = new RelayPool();

// ── Profile localStorage cache ──────────────────────────────────────────────
// Seeded synchronously at module init so profiles are in EventStore before
// the first React render — eliminates the npub flash on repeat visits.

const PROFILE_CACHE_KEY = "circl_profiles_v1";
const MAX_PROFILES = 2000;

function loadProfileCache() {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return;
    const events = JSON.parse(raw);
    for (const ev of Object.values(events)) eventStore.add(ev);
  } catch {}
}

function saveProfileToCache(event) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : {};
    cache[event.pubkey] = event;
    // Trim to MAX_PROFILES most recently seen (by object insertion order)
    const keys = Object.keys(cache);
    if (keys.length > MAX_PROFILES) {
      for (const k of keys.slice(0, keys.length - MAX_PROFILES)) delete cache[k];
    }
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

// Seed on module load (sync) then persist new profiles reactively
loadProfileCache();
eventStore.insert$.subscribe(event => {
  if (event.kind === 0) saveProfileToCache(event);
});

// ── Broadcast ───────────────────────────────────────────────────────────────
// Re-publish an already-signed event to all currently connected relays
// (which include the user's own outbox relays after login).

export function broadcastEvent(event) {
  if (!event?.id || !event?.sig) return Promise.resolve();
  const relays = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
  return Promise.race([
    pool.publish(relays, event),
    new Promise(resolve => setTimeout(resolve, 8000)),
  ]).catch(() => null);
}

// ── Event loader ────────────────────────────────────────────────────────────
// Uses pool.group(relays, false) to bypass the ignoreOffline=true default so
// relay hints in nevent references work even for relays not yet connected.
export const eventLoader = createEventLoader(
  (relays, filters) => pool.group(relays, false).request(filters),
  { eventStore, bufferTime: 300 },
);

// ── NDK-compat subscribe wrapper ────────────────────────────────────────────

export function nostrSubscribe(filters, opts = {}) {
  const { onEvent, onEose, closeOnEose } = opts;
  const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
  const wrap = ev => ({ ...ev, rawEvent: () => ev });

  if (closeOnEose) {
    const sub = pool.request(relayUrls, filters).subscribe({
      next: ev => { eventStore.add(ev); onEvent?.(wrap(ev)); },
      complete: () => onEose?.(),
      error: () => onEose?.(),
    });
    return { stop: () => sub.unsubscribe() };
  }

  const sub = pool.subscription(relayUrls, filters).subscribe({
    next: ev => { eventStore.add(ev); onEvent?.(wrap(ev)); },
  });
  return { stop: () => sub.unsubscribe() };
}
