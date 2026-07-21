import { EventStore } from "applesauce-core";
import { normalizeURL } from "applesauce-core/helpers/url";
import { RelayPool } from "applesauce-relay";
import { createEventLoader } from "applesauce-loaders/loaders";
import { BehaviorSubject, isObservable, map, merge, skip, take, debounceTime } from "rxjs";
import { DEFAULT_RELAYS } from "./constants.js";

export const eventStore = new EventStore();
export const pool = new RelayPool();

// Reject URLs that contain embedded protocol prefixes (concatenated relay lists)
// or literal/encoded whitespace — these come from malformed NIP-65 events.
export const validRelays = urls =>
  urls.filter(u => /^wss?:\/\/[^\s]+$/.test(u) && !/wss?:\/\//i.test(u.slice(6)));

// ── Blocked relays (NIP-51 kind 10006) ──────────────────────────────────────
// Every connection path in the app (persistent `.relay()` connections plus
// one-off `.request`/`.subscription`/`.publish`/`.group` calls) is routed
// through `pool`, so guarding these few methods here is enough to guarantee
// a blocked relay is never connected to, no matter which hook/component the
// request originates from.

// `pool.relay()` normalizes URLs (e.g. adds a trailing slash) before using
// them as Map keys, so comparisons must normalize both sides the same way
// or an already-connected relay never matches its blocked-list entry.
function safeNormalize(url) {
  try { return normalizeURL(url); } catch { return url; }
}

let blockedRelayUrls = new Set();

export function setBlockedRelayUrls(urls) {
  blockedRelayUrls = new Set(urls.map(safeNormalize));
  for (const url of pool.relays.keys()) {
    if (blockedRelayUrls.has(url)) pool.remove(url);
  }
}

const excludeBlocked = urls => {
  if (Array.isArray(urls)) return urls.filter(u => !blockedRelayUrls.has(safeNormalize(u)));
  if (isObservable(urls)) return urls.pipe(map(list => list.filter(u => !blockedRelayUrls.has(safeNormalize(u)))));
  return urls;
};

const _relay = pool.relay.bind(pool);
pool.relay = url => (blockedRelayUrls.has(safeNormalize(url)) ? undefined : _relay(url));

const _group = pool.group.bind(pool);
pool.group = (relays, ignoreOffline) => _group(excludeBlocked(relays), ignoreOffline);

const _publish = pool.publish.bind(pool);
pool.publish = (relays, event, opts) => _publish(excludeBlocked(relays), event, opts);

const _request = pool.request.bind(pool);
pool.request = (relays, filters, opts) => _request(excludeBlocked(relays), filters, opts);

const _subscription = pool.subscription.bind(pool);
pool.subscription = (relays, filters, opts) => _subscription(excludeBlocked(relays), filters, opts);

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
  const relays = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
  return Promise.race([
    pool.publish(relays, event),
    new Promise(resolve => setTimeout(resolve, 8000)),
  ]).catch(() => null);
}

// ── Publish status tracking ─────────────────────────────────────────────────
// Opt-in per-relay publish progress for the "publishing…" UI. Uses pool.event
// (not pool.publish) so we get one PublishResponse per relay as it resolves,
// instead of a single Promise that only settles once every relay is done.
//
// relay.event()'s own 10s eventTimeout only starts once the relay is ready
// (connected/authed) — if a relay is slow to connect or never comes up, that
// timer never starts and the row would hang forever. relay.publish() covers
// this with an outer publishTimeout, but we can't use it here since it
// batches all relays into one Promise instead of emitting per-relay. So we
// add our own ceiling below to guarantee every row eventually settles.
const PUBLISH_STATUS_TIMEOUT_MS = 20_000;

export const publishSession$ = new BehaviorSubject(null);

export function publishWithStatus(relays, event) {
  const id = Math.random();
  // pool.relay() normalizes URLs before using them as the Relay's own `.url`
  // (see pool.js), so every PublishResponse.from comes back normalized. Match
  // that here, or unnormalized entries (e.g. DEFAULT_RELAYS without a
  // trailing slash) never match their response and hang forever.
  const normalized = [...new Set(relays.map(safeNormalize))];
  publishSession$.next({
    id,
    event,
    relays: normalized.map(url => ({ url, status: "pending", message: null })),
  });

  const timer = setTimeout(() => {
    const cur = publishSession$.value;
    if (!cur || cur.id !== id) return;
    publishSession$.next({
      ...cur,
      relays: cur.relays.map(r => r.status === "pending" ? { ...r, status: "failed", message: "Timed out" } : r),
    });
  }, PUBLISH_STATUS_TIMEOUT_MS);

  return pool.event(normalized, event).subscribe({
    next: ({ from, ok, message }) => {
      const cur = publishSession$.value;
      if (!cur || cur.id !== id) return;
      publishSession$.next({
        ...cur,
        relays: cur.relays.map(r => r.url === from ? { ...r, status: ok ? "ok" : "failed", message } : r),
      });
    },
    complete: () => clearTimeout(timer),
    error: () => clearTimeout(timer),
  });
}

// ── Reactive relay list ─────────────────────────────────────────────────────
// Live view of the pool's connected relays (falling back to DEFAULT_RELAYS
// when empty) that grows as outbox/private relays are discovered after
// login. Pass this — instead of a one-time array snapshot — to
// pool.group(relayUrls$, false) so a query fired right after login keeps
// reaching newly-added relays instead of being pinned to whatever existed
// at mount time.
//
// pool.relays$ fires on *every* relay connecting anywhere in the app (login
// bootstrap, visiting a profile, opening a thread, ...), and pool.group()
// re-subscribes (tears down + reopens) every REQ built on this stream each
// time it emits. During boot several relays typically connect within the
// same second (default relays, then outbox relays as NIP-65 resolves), which
// was causing every mounted list hook to thrash through several
// resubscribes in quick succession. Emit the current snapshot immediately
// (so first load isn't delayed) but debounce subsequent bursts so a flurry
// of new relay connections collapses into a single resubscribe.
const relaysMapped$ = pool.relays$.pipe(
  map(m => (m.size > 0 ? [...m.keys()] : DEFAULT_RELAYS))
);
export const relayUrls$ = merge(
  relaysMapped$.pipe(take(1)),
  relaysMapped$.pipe(skip(1), debounceTime(750)),
);

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
  const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
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
