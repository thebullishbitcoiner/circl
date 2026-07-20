import { useState, useEffect, useRef, useCallback } from "react";
import { parseBolt11Msats, isHexPubkey, zapperPubkeyFromKind9735 } from "../utils.js";
import { pool, eventStore, relayUrls$ } from "../nostr.js";

// metaSub below shares one 500-event budget across every note from every
// followed author, so on an active feed any single note's reaction/zap count
// is frequently truncated until its thread is opened (which does a dedicated
// per-note "#e" fetch). This sweep periodically re-runs that same dedicated
// fetch for notes already loaded into the feed, so cards show accurate
// counts without requiring a visit to the thread.
const STATS_BACKFILL_INTERVAL_MS = 5_000;
const STATS_BACKFILL_CHUNK = 100;

function compareFeedEventsDesc(a, b) {
  const ta = Number(a?.created_at) || 0;
  const tb = Number(b?.created_at) || 0;
  if (tb !== ta) return tb - ta;
  const ia = a?.id ?? "";
  const ib = b?.id ?? "";
  return ia < ib ? 1 : ia > ib ? -1 : 0;
}

function sortFeedEventsChronological(events) {
  return [...events].sort(compareFeedEventsDesc);
}

export default function useFeed({ follows, setLocalReaction, addLocalZap, addLocalRepost }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const seen = useRef(new Set());
  // pubkey → { ids: Set<eventId>, addrs: Set<"kind:pubkey:d"> }
  const [deletionMap, setDeletionMap] = useState(new Map());

  const eventsRef = useRef(events);
  useEffect(() => { eventsRef.current = events; }, [events]);

  useEffect(() => {
    const authors = (follows || []).filter(isHexPubkey);
    if (!authors.length) return;
    setLoading(true);
    setEvents([]);
    setDeletionMap(new Map());
    seen.current = new Set();

    const since = Math.floor(Date.now() / 1000) - 60 * 60 * 48;

    // Pre-fetch profiles for all follows in parallel with the feed so names are
    // ready before (or immediately as) feed events render. Chunked to 50 per
    // request to stay within relay filter size limits.
    const CHUNK = 50;
    const profileSubs = [];
    for (let i = 0; i < authors.length; i += CHUNK) {
      const chunk = authors.slice(i, i + CHUNK);
      profileSubs.push(
        pool.group(relayUrls$, false).request([{ kinds: [0], authors: chunk }]).subscribe({
          next: event => eventStore.add(event),
        })
      );
    }

    const mainSub = pool.group(relayUrls$, false).subscription([{ kinds: [1, 6, 9802, 30023, 1068, 6969, 31922, 31923, 30311, 9041], authors, since, limit: 300 }]).subscribe({
      next: raw => {
        eventStore.add(raw);
        if (seen.current.has(raw.id)) return;
        seen.current.add(raw.id);
        setEvents(prev => sortFeedEventsChronological([raw, ...prev]));
        setLoading(false);
      },
    });

    const deleteSub = pool.group(relayUrls$, false).subscription([{ kinds: [5], authors, since }]).subscribe({
      next: raw => {
        const newIds = raw.tags.filter(t => t[0] === "e" && t[1]).map(t => t[1]);
        const newAddrs = raw.tags.filter(t => t[0] === "a" && t[1]).map(t => t[1]);
        if (!newIds.length && !newAddrs.length) return;
        setDeletionMap(prev => {
          const next = new Map(prev);
          const existing = next.get(raw.pubkey) ?? { ids: new Set(), addrs: new Set() };
          next.set(raw.pubkey, {
            ids: new Set([...existing.ids, ...newIds]),
            addrs: new Set([...existing.addrs, ...newAddrs]),
          });
          return next;
        });
      },
    });

    // Simulate EOSE timeout so loading clears if no events arrive
    const eoseTimer = setTimeout(() => setLoading(false), 10000);

    const handleMetaEvent = raw => {
      eventStore.add(raw);
      if (raw.kind === 7) {
        const targetId = raw.tags.find(t => t[0] === "e")?.[1];
        if (targetId && raw.content) {
          setLocalReaction?.(targetId, raw.pubkey, raw.content === "+" ? "💜" : raw.content, { id: raw.id, tags: raw.tags });
        }
      }
      if (raw.kind === 9735) {
        const targetId = raw.tags.find(t => t[0] === "e")?.[1];
        const bolt11 = raw.tags.find(t => t[0] === "bolt11")?.[1];
        if (targetId && bolt11) {
          const msats = parseBolt11Msats(bolt11);
          const descTag = raw.tags.find(t => t[0] === "description");
          let comment = "";
          if (descTag) {
            try { comment = JSON.parse(descTag[1]).content || ""; } catch {}
          }
          const zapper = zapperPubkeyFromKind9735(raw) ?? raw.pubkey;
          addLocalZap?.(targetId, { id: raw.id, zapper, amount: msats, comment });
        }
      }
    };

    const metaSub = pool.group(relayUrls$, false).subscription(
      [
        { kinds: [7], "#p": authors, since, limit: 500 },
        { kinds: [9735], "#p": authors, since, limit: 500 },
      ]
    ).subscribe({ next: handleMetaEvent });

    // Reposts/quotes are handled separately from handleMetaEvent because,
    // unlike reactions/zaps, kind-6/quote events from *followed* authors are
    // also fetched live by mainSub and rendered as their own feed cards. A
    // repost/quote from anyone else (found only via this backfill's "#e"/"#q"
    // sweep) must NOT be added to `events`, or it would start rendering as an
    // unrelated top-level card in the feed. It only feeds the local repost
    // ledger, which repostAndQuoteCount() unions with `events` by id so nothing
    // already counted from the live stream is double-counted.
    const handleBackfillEvent = raw => {
      const isRepost = raw.kind === 6;
      const isQuote = raw.kind === 1 && raw.tags?.some(t => t[0] === "q");
      if (isRepost || isQuote) {
        eventStore.add(raw);
        const targetId = isRepost
          ? raw.tags.find(t => t[0] === "e")?.[1]
          : raw.tags.find(t => t[0] === "q")?.[1];
        if (targetId) addLocalRepost?.(targetId, { id: raw.id, pubkey: raw.pubkey, kind: raw.kind });
        return;
      }
      handleMetaEvent(raw);
    };

    // Stats backfill sweep — see STATS_BACKFILL_INTERVAL_MS comment above.
    // Runs dedicated "#e"/"#q" fetches (no shared limit) for whatever notes
    // are currently loaded into the feed, so reaction/zap/repost/quote counts
    // are already accurate by the time a card scrolls into view instead of
    // only resolving when its thread is opened.
    const backfilled = new Set();
    const backfillSubs = [];
    const backfillTick = () => {
      const ids = eventsRef.current.map(e => e.id).filter(id => !backfilled.has(id));
      if (!ids.length) return;
      for (const id of ids) backfilled.add(id);
      for (let i = 0; i < ids.length; i += STATS_BACKFILL_CHUNK) {
        const chunk = ids.slice(i, i + STATS_BACKFILL_CHUNK);
        backfillSubs.push(
          pool.group(relayUrls$, false).request([
            { kinds: [6, 7, 9735], "#e": chunk },
            { kinds: [1], "#q": chunk },
          ]).subscribe({ next: handleBackfillEvent })
        );
      }
    };
    const firstBackfill = setTimeout(backfillTick, 1500);
    const backfillInterval = setInterval(backfillTick, STATS_BACKFILL_INTERVAL_MS);

    return () => {
      clearTimeout(eoseTimer);
      clearTimeout(firstBackfill);
      clearInterval(backfillInterval);
      for (const s of profileSubs) s.unsubscribe();
      for (const s of backfillSubs) s.unsubscribe();
      mainSub.unsubscribe();
      metaSub.unsubscribe();
      deleteSub.unsubscribe();
    };
  }, [(follows || []).filter(isHexPubkey).join(",")]);

  const prependEvent = useCallback(e => {
    if (!e || seen.current.has(e.id)) return;
    seen.current.add(e.id);
    setEvents(prev => sortFeedEventsChronological([e, ...prev]));
  }, []);

  const isDeleted = useCallback((event) => {
    if (!event) return false;
    const record = deletionMap.get(event.pubkey);
    if (!record) return false;
    if (record.ids.has(event.id)) return true;
    if (event.kind >= 30000 && event.kind < 40000) {
      const d = event.tags?.find(t => t[0] === "d")?.[1] ?? "";
      if (record.addrs.has(`${event.kind}:${event.pubkey}:${d}`)) return true;
    }
    return false;
  }, [deletionMap]);

  return { events, loading, prependEvent, isDeleted };
}
