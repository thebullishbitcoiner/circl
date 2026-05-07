import { useState, useEffect, useCallback, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";

/** NIP-51 standard bookmark list (replaceable). */
const BOOKMARK_LIST_KIND = 10003;

/** Build NIP-51 tag for an event: `e` for notes, `a` for kind 30023 articles. */
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

/**
 * NIP-51 bookmarks (kind 10003) with NIP-44 encrypted `content` (JSON array of tags).
 * Public `e` / `a` tags on the event are merged for interoperability.
 */
export default function useBookmarks({ ndk, pubkey, signAndPublish } = {}) {
  const [items, setItems] = useState([]);
  const itemsRef = useRef([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const instance = ndk?.current;
    const pk = normPubkey(pubkey);
    if (!instance || !isHexPubkey(pk)) {
      setItems([]);
      return;
    }

    let cancelled = false;
    setItems([]);
    const received = [];
    const sub = instance.subscribe(
      [{ kinds: [BOOKMARK_LIST_KIND], authors: [pk] }],
      { closeOnEose: true }
    );

    sub.on("event", e => {
      received.push(e.rawEvent());
    });
    sub.on("eose", () => {
      if (cancelled) return;
      try {
        sub.stop();
      } catch {}
      const latest =
        received.length === 0
          ? null
          : [...received].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];

      const apply = async () => {
        if (cancelled || !latest) {
          if (!cancelled) setItems([]);
          return;
        }
        let decrypted = [];
        const content = (latest.content || "").trim();
        if (content && hasNip44()) {
          try {
            const plain = await window.nostr.nip44.decrypt(latest.pubkey, latest.content);
            const parsed = JSON.parse(plain);
            if (Array.isArray(parsed)) decrypted = parsed;
          } catch {
            /* wrong key, legacy cipher, or corrupt */
          }
        }
        if (!cancelled) setItems(mergeBookmarkTags(decrypted, latest.tags));
      };
      void apply();
    });

    return () => {
      cancelled = true;
      try {
        sub.stop();
      } catch {}
    };
  }, [ndk, pubkey]);

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
