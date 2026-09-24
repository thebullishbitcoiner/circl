import { useState, useEffect } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";

const REFRESH_MS = 20 * 60 * 1000; // poll on mount, then every 20 min
const FOLLOWING_KEY = "circl_known_followers_v1"; // ground truth: who currently follows me
const NOTIFS_KEY = "circl_follow_notifications_v1"; // durable record of surfaced "started following you" items
const RETENTION_SEC = 60 * 60 * 24 * 30; // keep surfaced follow notifications around as long as the rest of the feed

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
}
function writeJSON(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj)); } catch {}
}

// null = never initialized for this pubkey (first run, seed silently)
function readFollowing(pk) {
  const all = readJSON(FOLLOWING_KEY);
  return Array.isArray(all[pk]) ? new Set(all[pk]) : null;
}
function writeFollowing(pk, set) {
  const all = readJSON(FOLLOWING_KEY);
  all[pk] = [...set];
  writeJSON(FOLLOWING_KEY, all);
}

function pruneNotifs(list) {
  const cutoff = Math.floor(Date.now() / 1000) - RETENTION_SEC;
  return list.filter(e => e.created_at >= cutoff);
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
    let following = readFollowing(me); // Set<hex> | null

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
          const currentAuthors = [...latestByAuthor.keys()];

          if (following === null) {
            // First-ever check for this account: establish the baseline, don't notify.
            following = new Set(currentAuthors);
            writeFollowing(me, following);
            return;
          }

          const newFollows = currentAuthors.filter(a => !following.has(a));
          // Ground-truth snapshot for next poll — anyone missing from
          // currentAuthors (unfollowed) drops out here, so a later re-follow
          // is detected as new again instead of being permanently suppressed.
          following = new Set(currentAuthors);
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
