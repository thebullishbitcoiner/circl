import { useState, useEffect, useCallback, useRef } from "react";
import { isHexPubkey, normPubkey, hasNip44, hasNip04, decryptListContent } from "../utils.js";
import { pool, eventStore, relayUrls$ } from "../nostr.js";

const BOOKMARK_LIST_KIND = 10003;
const CACHE_KEY = "circl_bookmarks";

export function bookmarkTagFromEvent(event) {
  if (!event?.id || !event.pubkey) return null;
  const pk = normPubkey(event.pubkey);
  if (!isHexPubkey(pk)) return null;
  if (event.kind === 30023) {
    const d = event.tags?.find(t => t[0] === "d")?.[1];
    if (d) return ["a", `30023:${pk}:${d}`];
  }
  return ["e", event.id];
}

export function bookmarkKey(tag) {
  if (!tag || tag.length < 2 || typeof tag[0] !== "string" || typeof tag[1] !== "string") return null;
  if (tag[0] === "e") return `e:${tag[1]}`;
  if (tag[0] === "a") return `a:${tag[1]}`;
  return null;
}

function mergeBookmarkTags(decryptedTags, publicEventTags) {
  const out = [];
  const seen = new Set();
  const push = t => {
    const k = bookmarkKey(t);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  if (Array.isArray(decryptedTags)) for (const t of decryptedTags) { if (Array.isArray(t)) push(t); }
  for (const t of publicEventTags || []) { if (t[0] === "e" || t[0] === "a") push(t); }
  return out;
}

// Cache stores decrypted bookmark tags + public key set per account
function readCache(pk) {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY))?.[pk] ?? null; } catch { return null; }
}
function writeCache(pk, items, publicKeys, created_at) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
    store[pk] = { created_at, items, publicKeys: [...publicKeys] };
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}

export default function useBookmarks({ pubkey, signAndPublish, refreshKey = 0 } = {}) {
  const [items, setItems] = useState(() => {
    const pk = normPubkey(pubkey);
    return isHexPubkey(pk) ? (readCache(pk)?.items ?? []) : [];
  });
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const settledRef = useRef(!!readCache(normPubkey(pubkey)));
  // Tracks bookmark keys that live in public tags — preserved on publish, new additions always go private
  const publicKeysRef = useRef(new Set(readCache(normPubkey(pubkey))?.publicKeys ?? []));

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) { setItems([]); return; }

    let cancelled = false;
    let generation = 0;

    // Restore from decrypted cache immediately — no relay round-trip or crypto needed
    const cached = readCache(pk);
    if (cached) {
      setItems(cached.items);
    } else {
      setItems([]);
    }

    let latestEvent = null;
    let knownCreatedAt = cached?.created_at ?? 0;
    let processTimer = null;
    let bgRetryCount = 0;

    const process = async () => {
      if (cancelled || !latestEvent) return;
      const gen = ++generation;
      const ev = latestEvent;

      let decrypted = [];
      const content = (ev.content || "").trim();
      // On mobile the signer may not be injected yet — wait up to 3 s
      if (content && !hasNip44() && !hasNip04()) {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 500));
          if (cancelled || hasNip44() || hasNip04()) break;
        }
      }
      if (cancelled || generation !== gen) return;
      let decryptFailed = false;
      if (content && (hasNip44() || hasNip04())) {
        let plain = null;
        // A signer can transiently fail/timeout under concurrent load (e.g. other
        // components decrypting at the same time) — retry before giving up.
        for (let attempt = 0; attempt < 4 && !plain; attempt++) {
          if (attempt > 0) await new Promise(r => setTimeout(r, 700 * attempt));
          if (cancelled || generation !== gen) return;
          plain = await decryptListContent(ev.pubkey, content);
        }
        if (plain) {
          try {
            const parsed = JSON.parse(plain);
            if (Array.isArray(parsed)) decrypted = parsed;
          } catch {}
        } else {
          decryptFailed = true;
        }
      }
      if (decryptFailed) {
        // Don't let a failed decrypt clobber a known-good list with an empty one —
        // keep whatever's already showing (cache or prior state). Self-heal with a
        // couple of delayed background retries instead of requiring a manual refresh.
        settledRef.current = true;
        if (!cancelled && bgRetryCount < 2) {
          bgRetryCount++;
          setTimeout(() => { if (!cancelled) process(); }, 5000);
        }
        return;
      }
      if (!cancelled && generation === gen) {
        const merged = mergeBookmarkTags(decrypted, ev.tags);
        const publicKeys = new Set(
          (ev.tags || []).filter(t => t[0] === "e" || t[0] === "a").map(t => bookmarkKey(t)).filter(Boolean)
        );
        setItems(merged);
        itemsRef.current = merged;
        publicKeysRef.current = publicKeys;
        writeCache(pk, merged, publicKeys, ev.created_at);
        knownCreatedAt = ev.created_at;
        settledRef.current = true;
      }
    };

    const sub = pool.group(relayUrls$, false).subscription([{ kinds: [BOOKMARK_LIST_KIND], authors: [pk] }]).subscribe({
      next: raw => {
        if (raw.kind !== BOOKMARK_LIST_KIND) return;
        eventStore.add(raw);
        if (!cancelled && raw.created_at > Math.max(knownCreatedAt, latestEvent?.created_at ?? 0)) {
          latestEvent = raw;
          clearTimeout(processTimer);
          processTimer = setTimeout(process, 300);
        }
      },
      // Only show empty on a subscription error if we never got a real
      // answer at all — a relay disconnecting *after* successfully
      // delivering the list (normal for a long-lived subscription) must not
      // clobber data that's already loaded and showing.
      error: () => { if (!cancelled && !cached && !settledRef.current) setItems([]); },
    });

    const cutoffTimer = setTimeout(() => {
      sub.unsubscribe();
      settledRef.current = true;
      // Only reprocess if the current latestEvent hasn't already been
      // successfully applied — otherwise this redundantly re-decrypts and
      // re-emits a new (but content-identical) `items` array, which ripples
      // into anything downstream keyed on that reference (e.g. the bookmarks
      // screen's event-resolution effect tearing down and restarting).
      if (!latestEvent || latestEvent.created_at !== knownCreatedAt) process();
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(processTimer);
      clearTimeout(cutoffTimer);
      sub.unsubscribe();
    };
  }, [pubkey, refreshKey]);

  const persist = useCallback(
    async nextItems => {
      const pk = normPubkey(pubkey);
      if (!signAndPublish || !isHexPubkey(pk)) throw new Error("Sign in to sync bookmarks");
      if (!hasNip44()) throw new Error("Your wallet does not support NIP-44 (update the extension)");
      if (!settledRef.current) throw new Error("Bookmarks are still syncing from relays, please try again in a moment");
      // Preserve existing public bookmarks in tags; everything else goes encrypted
      const publicTags  = nextItems.filter(t => publicKeysRef.current.has(bookmarkKey(t)));
      const privateTags = nextItems.filter(t => !publicKeysRef.current.has(bookmarkKey(t)));
      const content = privateTags.length > 0
        ? await window.nostr.nip44.encrypt(pk, JSON.stringify(privateTags))
        : "";
      await signAndPublish({ kind: BOOKMARK_LIST_KIND, content, tags: publicTags });
    },
    [signAndPublish, pubkey]
  );

  const toggle = useCallback(
    async event => {
      const tag = bookmarkTagFromEvent(event);
      if (!tag) return;
      const k = bookmarkKey(tag);
      const prev = itemsRef.current;
      const filtered = prev.filter(t => bookmarkKey(t) !== k);
      const next = filtered.length < prev.length ? filtered : [...filtered, tag];
      itemsRef.current = next;
      setItems(next);
      try { await persist(next); } catch (e) { itemsRef.current = prev; setItems(prev); throw e; }
    },
    [persist]
  );

  // Removes a raw bookmark tag directly by key, for entries that never resolved to
  // an event (e.g. an unsupported addressable kind) and so have no event object to
  // derive the tag from via toggle()/bookmarkTagFromEvent.
  const removeTag = useCallback(
    async tag => {
      const k = bookmarkKey(tag);
      if (!k) return;
      const prev = itemsRef.current;
      const next = prev.filter(t => bookmarkKey(t) !== k);
      if (next.length === prev.length) return;
      itemsRef.current = next;
      setItems(next);
      try { await persist(next); } catch (e) { itemsRef.current = prev; setItems(prev); throw e; }
    },
    [persist]
  );

  const isBookmarked = useCallback(
    event => {
      if (!event?.id) return false;
      const t = bookmarkTagFromEvent(event);
      const k = bookmarkKey(t);
      if (!k) return false;
      return items.some(x => bookmarkKey(x) === k);
    },
    [items]
  );

  return { toggle, isBookmarked, bookmarkItems: items, nip44Bookmarks: hasNip44(), removeTag };
}
