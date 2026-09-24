import { useState, useEffect } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";

const REFRESH_MS = 20 * 60 * 1000; // poll on mount, then every 20 min
const FOLLOWING_KEY = "circl_known_followers_v1"; // ground truth: who currently follows me
const NOTIFS_KEY = "circl_follow_notifications_v1"; // durable record of surfaced "started following you" items
const RETENTION_SEC = 60 * 60 * 24 * 30; // keep surfaced follow notifications around as long as the rest of the feed
// A relay query for any given poll is best-effort — it can transiently miss a real
// follower's event even though nothing changed. Only treat someone as unfollowed
// once they've been absent from results for a full day, not just a single poll,
// so that flakiness doesn't get misread as unfollow-then-refollow.
const UNFOLLOW_GRACE_SEC = 60 * 60 * 24;

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
}
function writeJSON(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj)); } catch {}
}

// Returns null (first run for this pubkey) or a Map<authorPubkey, lastSeenAt>.
function readFollowing(pk) {
  const all = readJSON(FOLLOWING_KEY);
  const stored = all[pk];
  if (stored == null) return null;
  if (Array.isArray(stored)) {
    // Migrating from the older ever-growing array format — treat everyone in
    // it as seen right now rather than dropping them (and re-notifying).
    const now = Math.floor(Date.now() / 1000);
    return new Map(stored.map(a => [a, now]));
  }
  return new Map(Object.entries(stored));
}
function writeFollowing(pk, map) {
  const all = readJSON(FOLLOWING_KEY);
  all[pk] = Object.fromEntries(map);
  writeJSON(FOLLOWING_KEY, all);
}

function dedupeById(list) {
  const seen = new Set();
  const out = [];
  for (const e of list) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}
function pruneNotifs(list) {
  const cutoff = Math.floor(Date.now() / 1000) - RETENTION_SEC;
  return dedupeById(list.filter(e => e.created_at >= cutoff));
}
function readStoredNotifs(pk) {
  const all = readJSON(NOTIFS_KEY);
  return pruneNotifs(Array.isArray(all[pk]) ? all[pk] : []);
}
function writeStoredNotifs(pk, list) {
  const all = readJSON(NOTIFS_KEY);
  all[pk] = list;
  writeJSON(NOTIFS_KEY, all);
}

export default function useNewFollowers({ pubkey }) {
  const me = normPubkey(pubkey);
  // Minimal event shape is all the notification pipeline needs to render a
  // "started following you" row — no need to persist the full (potentially
  // huge) contact-list event just to keep this notification alive.
  const [items, setItems] = useState(() => (isHexPubkey(me) ? readStoredNotifs(me) : []));

  useEffect(() => {
    if (!isHexPubkey(me)) { setItems([]); return; }

    let cancelled = false;
    let following = readFollowing(me); // Map<hex, lastSeenAt> | null

    // Re-hydrate from durable storage on every mount, so a page refresh
    // doesn't lose notifications that already surfaced but haven't expired.
    setItems(readStoredNotifs(me));

    function poll() {
      const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
      const latestByAuthor = new Map();

      pool.request(relayUrls, [{ kinds: [3], "#p": [me] }]).subscribe({
        next: raw => {
          eventStore.add(raw);
          const author = normPubkey(raw.pubkey);
          const prev = latestByAuthor.get(author);
          if (!prev || raw.created_at > prev.created_at) latestByAuthor.set(author, raw);
        },
        complete: () => {
          if (cancelled) return;
          const now = Math.floor(Date.now() / 1000);
          const currentAuthors = [...latestByAuthor.keys()];
          const currentSet = new Set(currentAuthors);

          if (following === null) {
            // First-ever check for this account: establish the baseline, don't notify.
            following = new Map(currentAuthors.map(a => [a, now]));
            writeFollowing(me, following);
            return;
          }

          const newFollows = currentAuthors.filter(a => !following.has(a));

          // Refresh the "last seen following me" timestamp for everyone this poll confirmed.
          for (const a of currentAuthors) following.set(a, now);
          // Only drop someone once they've been missing long enough to be a real
          // unfollow rather than a relay query simply not surfacing them this time.
          for (const [a, lastSeen] of following) {
            if (!currentSet.has(a) && now - lastSeen > UNFOLLOW_GRACE_SEC) following.delete(a);
          }
          writeFollowing(me, following);
          if (!newFollows.length) return;

          const fresh = newFollows.map(a => {
            const ev = latestByAuthor.get(a);
            return { id: ev.id, pubkey: ev.pubkey, created_at: ev.created_at, kind: 3, tags: [] };
          });
          const merged = pruneNotifs([...readStoredNotifs(me), ...fresh]);
          writeStoredNotifs(me, merged);
          setItems(merged);
        },
      });
    }

    poll();
    const interval = setInterval(poll, REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [me]);

  return { items };
}
