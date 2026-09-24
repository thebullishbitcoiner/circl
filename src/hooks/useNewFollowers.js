import { useState, useEffect } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS, UNFOLLOW_KIND } from "../constants.js";

const REFRESH_MS = 20 * 60 * 1000; // poll on mount, then every 20 min
const FOLLOWING_KEY = "circl_known_followers_v1"; // ground truth: who currently follows me
const NOTIFS_KEY = "circl_follow_notifications_v1"; // durable record of surfaced follow/unfollow items
const LASTPOLL_KEY = "circl_follow_lastpoll_v1"; // when the last non-empty poll completed
const RETENTION_SEC = 60 * 60 * 24 * 30; // keep surfaced notifications around as long as the rest of the feed
// A relay query is best-effort and can miss a real follower for a poll (or a whole
// baseline, if relays hadn't connected yet). Only consider someone a possible
// unfollow after a full day of absence, and then confirm it against their actual
// latest contact list before notifying.
const UNFOLLOW_GRACE_SEC = 60 * 60 * 24;
// A genuine new follow means the follower published a contact list after our last
// poll. Anyone whose latest list is older than that was already following and was
// just missed earlier, so they're recorded silently.
const NEW_FOLLOW_SLACK_SEC = 10 * 60;
const CONFIRM_TIMEOUT_MS = 8000;

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

function readLastPoll(pk) {
  const v = readJSON(LASTPOLL_KEY)[pk];
  return typeof v === "number" ? v : null;
}
function writeLastPoll(pk, ts) {
  const all = readJSON(LASTPOLL_KEY);
  all[pk] = ts;
  writeJSON(LASTPOLL_KEY, all);
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

// Resolves to the author's latest kind:3 event, or null if none was found in time.
function fetchLatestContactList(author, relayUrls) {
  return new Promise(resolve => {
    let latest = null, done = false, sub = null, timer = null;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sub?.unsubscribe();
      resolve(latest);
    };
    sub = pool.request(relayUrls, [{ kinds: [3], authors: [author], limit: 1 }]).subscribe({
      next: raw => { if (!latest || raw.created_at > latest.created_at) latest = raw; },
      complete: finish,
      error: finish,
    });
    timer = setTimeout(finish, CONFIRM_TIMEOUT_MS);
    if (done) sub.unsubscribe();
  });
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

    function pushNotifs(newItems) {
      const merged = pruneNotifs([...readStoredNotifs(me), ...newItems]);
      writeStoredNotifs(me, merged);
      if (!cancelled) setItems(merged);
    }

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
            if (currentAuthors.length) writeLastPoll(me, now);
            return;
          }

          // No recorded last poll (upgrade path): treat every already-present follower as silent.
          const lastPollAt = readLastPoll(me) ?? now;
          const genuineCutoff = lastPollAt - NEW_FOLLOW_SLACK_SEC;
          const newFollows = currentAuthors.filter(
            a => !following.has(a) && latestByAuthor.get(a).created_at >= genuineCutoff
          );

          // Refresh "last seen following me" for everyone this poll confirmed
          // (this also silently absorbs followers we'd merely missed before).
          for (const a of currentAuthors) following.set(a, now);
          const staleAuthors = [...following.keys()].filter(
            a => !currentSet.has(a) && now - following.get(a) > UNFOLLOW_GRACE_SEC
          );
          writeFollowing(me, following);
          // A poll that returned nothing likely means relays weren't reachable, so
          // don't advance the "since" marker past follows we might have missed.
          if (currentAuthors.length) writeLastPoll(me, now);

          if (newFollows.length) {
            pushNotifs(newFollows.map(a => {
              const ev = latestByAuthor.get(a);
              return { id: ev.id, pubkey: ev.pubkey, created_at: ev.created_at, kind: 3, tags: [] };
            }));
          }

          if (staleAuthors.length) {
            // Absence from the #p query isn't proof of an unfollow — check each
            // account's actual latest contact list before saying they left.
            Promise.all(staleAuthors.map(async a => ({ a, latest: await fetchLatestContactList(a, relayUrls) }))).then(results => {
              if (cancelled) return;
              const t = Math.floor(Date.now() / 1000);
              const gone = [];
              for (const { a, latest } of results) {
                if (!latest) continue; // couldn't confirm either way — retry next poll
                const stillFollows = latest.tags?.some(tag => tag[0] === "p" && normPubkey(tag[1]) === me);
                if (stillFollows) {
                  following.set(a, t);
                } else {
                  following.delete(a);
                  gone.push({ id: `unfollow:${a}:${t}`, pubkey: a, created_at: t, kind: UNFOLLOW_KIND, tags: [] });
                }
              }
              writeFollowing(me, following);
              if (gone.length) pushNotifs(gone);
            });
          }
        },
      });
    }

    poll();
    const interval = setInterval(poll, REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [me]);

  return { items };
}
