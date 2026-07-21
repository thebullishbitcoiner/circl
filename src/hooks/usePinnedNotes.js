import { useState, useEffect, useCallback, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore, relayUrls$ } from "../nostr.js";

const PIN_LIST_KIND = 10001;
const CACHE_KEY = "circl_pins";

export function readPinnedCache(pk) {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY))?.[pk] ?? null; } catch { return null; }
}
export function writePinnedCache(pk, items, created_at, events = []) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
    store[pk] = { created_at, items, events };
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}
const readCache = readPinnedCache;

export default function usePinnedNotes({ pubkey, signAndPublish } = {}) {
  const [items, setItems] = useState(() => {
    const pk = normPubkey(pubkey);
    return isHexPubkey(pk) ? (readCache(pk)?.items ?? []) : [];
  });
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const settledRef = useRef(!!readCache(normPubkey(pubkey)));

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) { setItems([]); return; }

    let cancelled = false;
    let generation = 0;

    const cached = readCache(pk);
    if (cached) {
      setItems(cached.items);
    } else {
      setItems([]);
    }

    let latestEvent = null;
    let knownCreatedAt = cached?.created_at ?? 0;
    let processTimer = null;

    const process = () => {
      if (cancelled || !latestEvent) return;
      const gen = ++generation;
      const ev = latestEvent;
      const ids = (ev.tags || []).filter(t => t[0] === "e" && typeof t[1] === "string").map(t => t[1]);
      if (!cancelled && generation === gen) {
        setItems(ids);
        itemsRef.current = ids;
        writePinnedCache(pk, ids, ev.created_at, readCache(pk)?.events ?? []);
        knownCreatedAt = ev.created_at;
        settledRef.current = true;
      }
    };

    const sub = pool.group(relayUrls$, false).subscription([{ kinds: [PIN_LIST_KIND], authors: [pk] }]).subscribe({
      next: raw => {
        if (raw.kind !== PIN_LIST_KIND) return;
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
      // successfully applied — otherwise this redundantly re-emits a new
      // (but content-identical) `items` array for no reason.
      if (!latestEvent || latestEvent.created_at !== knownCreatedAt) process();
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(processTimer);
      clearTimeout(cutoffTimer);
      sub.unsubscribe();
    };
  }, [pubkey]);

  const persist = useCallback(
    async nextIds => {
      const pk = normPubkey(pubkey);
      if (!signAndPublish || !isHexPubkey(pk)) throw new Error("Sign in to update pin list");
      if (!settledRef.current) throw new Error("Pin list is still syncing from relays, please try again in a moment");
      await signAndPublish({ kind: PIN_LIST_KIND, content: "", tags: nextIds.map(id => ["e", id]) });
    },
    [signAndPublish, pubkey]
  );

  const pinNote = useCallback(
    async event => {
      if (event?.kind !== 1 || !event?.id) return;
      const prev = itemsRef.current;
      if (prev.includes(event.id)) return;
      const next = [...prev, event.id];
      itemsRef.current = next;
      setItems(next);
      try { await persist(next); } catch (e) { itemsRef.current = prev; setItems(prev); throw e; }
    },
    [persist]
  );

  const unpinNote = useCallback(
    async event => {
      if (!event?.id) return;
      const prev = itemsRef.current;
      const next = prev.filter(id => id !== event.id);
      if (next.length === prev.length) return;
      itemsRef.current = next;
      setItems(next);
      try { await persist(next); } catch (e) { itemsRef.current = prev; setItems(prev); throw e; }
    },
    [persist]
  );

  const togglePin = useCallback(
    async event => {
      if (itemsRef.current.includes(event?.id)) return unpinNote(event);
      return pinNote(event);
    },
    [pinNote, unpinNote]
  );

  const isPinned = useCallback(
    event => {
      if (event?.kind !== 1 || !event?.id) return false;
      return items.includes(event.id);
    },
    [items]
  );

  return { pinnedIds: items, pinNote, unpinNote, togglePin, isPinned };
}
