import { useState, useEffect, useRef, useCallback } from "react";
import { parseBolt11Msats, isHexPubkey, zapperPubkeyFromKind9735 } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";

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

export default function useFeed({ follows, setLocalReaction, addLocalZap }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const seen = useRef(new Set());
  // pubkey → { ids: Set<eventId>, addrs: Set<"kind:pubkey:d"> }
  const [deletionMap, setDeletionMap] = useState(new Map());

  useEffect(() => {
    const authors = (follows || []).filter(isHexPubkey);
    if (!authors.length) return;
    setLoading(true);
    setEvents([]);
    setDeletionMap(new Map());
    seen.current = new Set();

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
    const since = Math.floor(Date.now() / 1000) - 60 * 60 * 48;

    // Pre-fetch profiles for all follows in parallel with the feed so names are
    // ready before (or immediately as) feed events render. Chunked to 50 per
    // request to stay within relay filter size limits.
    const CHUNK = 50;
    const profileSubs = [];
    for (let i = 0; i < authors.length; i += CHUNK) {
      const chunk = authors.slice(i, i + CHUNK);
      profileSubs.push(
        pool.request(relayUrls, [{ kinds: [0], authors: chunk }]).subscribe({
          next: event => eventStore.add(event),
        })
      );
    }

    const mainSub = pool.subscription(relayUrls, [{ kinds: [1, 6, 9802, 30023, 1068, 6969, 31922, 31923, 30311, 9041], authors, since, limit: 300 }]).subscribe({
      next: raw => {
        eventStore.add(raw);
        if (seen.current.has(raw.id)) return;
        seen.current.add(raw.id);
        setEvents(prev => sortFeedEventsChronological([raw, ...prev]));
        setLoading(false);
      },
    });

    const deleteSub = pool.subscription(relayUrls, [{ kinds: [5], authors, since }]).subscribe({
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

    const metaSub = pool.subscription(
      relayUrls,
      [
        { kinds: [7], "#p": authors, since, limit: 500 },
        { kinds: [9735], "#p": authors, since, limit: 500 },
      ]
    ).subscribe({
      next: raw => {
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
      },
    });

    return () => {
      clearTimeout(eoseTimer);
      for (const s of profileSubs) s.unsubscribe();
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
