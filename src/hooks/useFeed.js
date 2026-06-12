import { useState, useEffect, useRef, useCallback } from "react";
import { parseBolt11Msats, isHexPubkey, zapperPubkeyFromKind9735 } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

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

  useEffect(() => {
    const authors = (follows || []).filter(isHexPubkey);
    if (!authors.length) return;
    setLoading(true);

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
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
            setLocalReaction?.(targetId, raw.pubkey, raw.content === "+" ? "🧡" : raw.content, { id: raw.id, tags: raw.tags });
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
    };
  }, [(follows || []).filter(isHexPubkey).join(",")]);

  const prependEvent = useCallback(e => {
    if (!e || seen.current.has(e.id)) return;
    seen.current.add(e.id);
    setEvents(prev => sortFeedEventsChronological([e, ...prev]));
  }, []);

  return { events, loading, prependEvent };
}
