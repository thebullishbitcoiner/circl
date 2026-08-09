import { useEffect, useState } from "react";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS, PLATFORM_PUBKEY, INNER_CIRCL_BADGE_A_TAG } from "../constants.js";

// Module-scope: pubkey -> earliest award `created_at` (seconds) for the
// Inner Circl badge (kind 8) issued by the platform account, referencing
// the Inner Circl badge definition (kind 30009).
const innerCirclAwards = new Map();

// Module-scope: pubkeys registered in /.well-known/nostr.json. Piggybacked
// as the Inner Circl membership list for now, until real badge awards (above)
// are flowing from the platform account.
const nostrJsonPubkeys = new Set();

const listeners = new Set();
let started = false;

function notify() {
  for (const fn of listeners) fn();
}

function addAward(event) {
  if (event.kind !== 8 || event.pubkey !== PLATFORM_PUBKEY) return;
  const hasBadgeTag = event.tags.some(t => t[0] === "a" && t[1] === INNER_CIRCL_BADGE_A_TAG);
  if (!hasBadgeTag) return;
  let changed = false;
  for (const t of event.tags) {
    if (t[0] !== "p" || !t[1]) continue;
    const prev = innerCirclAwards.get(t[1]);
    if (prev === undefined || event.created_at < prev) {
      innerCirclAwards.set(t[1], event.created_at);
      changed = true;
    }
  }
  if (changed) notify();
}

function loadNostrJsonMembers() {
  fetch("/.well-known/nostr.json")
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      const names = data?.names || {};
      let changed = false;
      for (const pk of Object.values(names)) {
        if (typeof pk === "string" && /^[0-9a-f]{64}$/i.test(pk) && !nostrJsonPubkeys.has(pk)) {
          nostrJsonPubkeys.add(pk);
          changed = true;
        }
      }
      if (changed) notify();
    })
    .catch(() => {});
}

function start() {
  if (started) return;
  started = true;

  loadNostrJsonMembers();

  if (!PLATFORM_PUBKEY) return;
  const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
  pool.request(relayUrls, [{ kinds: [8], authors: [PLATFORM_PUBKEY] }]).subscribe({
    next: event => { eventStore.add(event); addAward(event); },
  });

  eventStore.insert$.subscribe(event => {
    if (event.kind === 8) addAward(event);
  });
}

function useSubscribed() {
  const [, setTick] = useState(0);
  useEffect(() => {
    start();
    const fn = () => setTick(t => t + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
}

/** Whether `pk` has been issued the platform's Inner Circl badge. */
export function useIsInnerCircl(pk) {
  useSubscribed();
  return !!pk && (nostrJsonPubkeys.has(pk) || innerCirclAwards.has(pk));
}

/** The year `pk`'s Inner Circl badge was issued, or null if not a member. */
export function useInnerCirclBadgeYear(pk) {
  useSubscribed();
  if (!pk) return null;
  const createdAt = innerCirclAwards.get(pk);
  if (createdAt !== undefined) return new Date(createdAt * 1000).getFullYear();
  if (nostrJsonPubkeys.has(pk)) return new Date().getFullYear();
  return null;
}
