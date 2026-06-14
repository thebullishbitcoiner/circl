import { useState, useEffect, useCallback, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

const BOOKMARK_LIST_KIND = 10003;

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
  if (Array.isArray(decryptedTags)) {
    for (const t of decryptedTags) {
      if (Array.isArray(t)) push(t);
    }
  }
  for (const t of publicEventTags || []) {
    if (t[0] === "e" || t[0] === "a") push(t);
  }
  return out;
}

function hasNip44() {
  return (
    typeof window !== "undefined" &&
    typeof window.nostr?.nip44?.encrypt === "function" &&
    typeof window.nostr?.nip44?.decrypt === "function"
  );
}

// Persists decrypted output across remounts so navigation doesn't flash empty
const _cache = new Map(); // pk → items[]

export default function useBookmarks({ pubkey, signAndPublish, refreshKey = 0 } = {}) {
  const [items, setItems] = useState(() => {
    const pk = normPubkey(pubkey);
    return isHexPubkey(pk) ? (_cache.get(pk) ?? []) : [];
  });
  const itemsRef = useRef([]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) { setItems([]); return; }

    let cancelled = false;
    let generation = 0;
    // Only wipe state if we have nothing cached to show while re-fetching
    if (!_cache.has(pk)) setItems([]);
    let latestEvent = null;
    let processTimer = null;

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;

    const process = async () => {
      if (cancelled || !latestEvent) return;
      const gen = ++generation;
      const ev = latestEvent;

      let decrypted = [];
      const content = (ev.content || "").trim();
      // On mobile, the signer may not be injected yet — wait up to 3 s
      if (content && !hasNip44()) {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 500));
          if (cancelled || hasNip44()) break;
        }
      }
      if (cancelled || generation !== gen) return;
      if (content && hasNip44()) {
        try {
          const plain = await window.nostr.nip44.decrypt(ev.pubkey, ev.content);
          const parsed = JSON.parse(plain);
          if (Array.isArray(parsed)) decrypted = parsed;
        } catch {}
      }
      if (!cancelled && generation === gen) {
        const merged = mergeBookmarkTags(decrypted, ev.tags);
        setItems(merged);
        _cache.set(pk, merged);
      }
    };

    // Seed from eventStore immediately — no relay round-trip needed on remount
    try {
      const stored = eventStore.getTimeline([{ kinds: [BOOKMARK_LIST_KIND], authors: [pk], limit: 1 }])?.[0];
      if (stored) { latestEvent = stored; processTimer = setTimeout(process, 0); }
    } catch {}

    // Use subscription (not request) so events arriving after EOSE aren't dropped
    const sub = pool.subscription(relayUrls, [{ kinds: [BOOKMARK_LIST_KIND], authors: [pk] }]).subscribe({
      next: raw => {
        eventStore.add(raw);
        if (!cancelled && (!latestEvent || raw.created_at > latestEvent.created_at)) {
          latestEvent = raw;
          clearTimeout(processTimer);
          processTimer = setTimeout(process, 300);
        }
      },
      error: () => { if (!cancelled) setItems([]); },
    });

    const cutoffTimer = setTimeout(() => { sub.unsubscribe(); process(); }, 8000);

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
      const plaintext = JSON.stringify(nextItems);
      const ciphertext = await window.nostr.nip44.encrypt(pk, plaintext);
      await signAndPublish({
        kind: BOOKMARK_LIST_KIND,
        content: ciphertext,
        tags: [],
      });
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
      try {
        await persist(next);
      } catch (e) {
        itemsRef.current = prev;
        setItems(prev);
        throw e;
      }
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

  return { toggle, isBookmarked, bookmarkItems: items, nip44Bookmarks: hasNip44() };
}
