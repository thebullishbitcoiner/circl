import { useState, useEffect, useRef, useCallback } from "react";
import { parseBolt11Msats, isHexPubkey } from "../utils.js";

/** Newest first; stable when `created_at` matches (avoids non-deterministic order). */
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

export default function useFeed({ ndk, follows, setLocalReaction, addLocalZap }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const seen = useRef(new Set());

  useEffect(() => {
    const instance = ndk?.current;
    const authors = (follows || []).filter(isHexPubkey);
    if (!instance || !authors.length) return;
    setLoading(true);

    const since = Math.floor(Date.now() / 1000) - 60 * 60 * 48;

    const sub = instance.subscribe(
      [{ kinds: [1, 6, 30023], authors, since, limit: 300 }],
      {}
    );

    sub.on("event", e => {
      const raw = e.rawEvent();
      if (seen.current.has(raw.id)) return;
      seen.current.add(raw.id);
      setEvents(prev => sortFeedEventsChronological([raw, ...prev]));
      setLoading(false);
    });

    sub.on("eose", () => setLoading(false));

    const metaSub = instance.subscribe(
      [
        { kinds: [7],    authors, since, limit: 500 },
        { kinds: [9735], since, limit: 500 },
      ],
      {}
    );

    metaSub.on("event", e => {
      const raw = e.rawEvent();
      if (raw.kind === 7) {
        const targetId = raw.tags.find(t => t[0] === "e")?.[1];
        if (targetId && raw.content) {
          setLocalReaction?.(targetId, raw.pubkey, raw.content === "+" ? "🧡" : raw.content);
        }
      }
      if (raw.kind === 9735) {
        const targetId  = raw.tags.find(t => t[0] === "e")?.[1];
        const bolt11    = raw.tags.find(t => t[0] === "bolt11")?.[1];
        const zapperTag = raw.tags.find(t => t[0] === "P") || raw.tags.find(t => t[0] === "p");
        if (targetId && bolt11) {
          const msats = parseBolt11Msats(bolt11);
          const descTag = raw.tags.find(t => t[0] === "description");
          let comment = "";
          if (descTag) {
            try { comment = JSON.parse(descTag[1]).content || ""; } catch {}
          }
          addLocalZap?.(targetId, { zapper: zapperTag?.[1] || raw.pubkey, amount: msats, comment });
        }
      }
    });

    return () => { sub.stop(); metaSub.stop(); };
  }, [ndk, (follows || []).filter(isHexPubkey).join(",")]);

  const prependEvent = useCallback(e => {
    if (!e || seen.current.has(e.id)) return;
    seen.current.add(e.id);
    setEvents(prev => sortFeedEventsChronological([e, ...prev]));
  }, []);

  return { events, loading, prependEvent };
}
