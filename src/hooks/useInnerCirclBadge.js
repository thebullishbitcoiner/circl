import { useEffect, useState } from "react";
import { pool, eventStore } from "../nostr.js";
import {
  DEFAULT_RELAYS,
  PLATFORM_PUBKEY,
  INNER_CIRCL_BADGE_A_TAG,
  TEST_INNER_CIRCL_PUBKEYS,
} from "../constants.js";

// Module-scope: pubkey -> earliest award `created_at` (seconds) for the
// Inner Circl badge (kind 8) issued by the platform account, referencing
// the Inner Circl badge definition (kind 30009).
const innerCirclAwards = new Map();
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

function start() {
  if (started || !PLATFORM_PUBKEY) return;
  started = true;

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
  return !!pk && (TEST_INNER_CIRCL_PUBKEYS.includes(pk) || innerCirclAwards.has(pk));
}

/** The year `pk`'s Inner Circl badge was issued, or null if not a member. */
export function useInnerCirclBadgeYear(pk) {
  useSubscribed();
  if (!pk) return null;
  const createdAt = innerCirclAwards.get(pk);
  if (createdAt !== undefined) return new Date(createdAt * 1000).getFullYear();
  if (TEST_INNER_CIRCL_PUBKEYS.includes(pk)) return new Date().getFullYear();
  return null;
}
