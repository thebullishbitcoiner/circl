import { useState, useEffect } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";

/** Parse NIP-33 `a` value: `<kind>:<hex pubkey>:<d>`. */
function parseAddressTag(val) {
  if (typeof val !== "string") return null;
  const m = val.match(/^(\d+):([0-9a-fA-F]{64}):([\s\S]+)$/);
  if (!m) return null;
  const kind = parseInt(m[1], 10);
  const pk = normPubkey(m[2]);
  const d = m[3];
  if (!isHexPubkey(pk)) return null;
  return { kind, pubkey: pk, d };
}

/**
 * Resolve bookmark tag tuples into full events (notes by id, articles by address).
 * Order matches `bookmarkTags`. Omits entries relays do not return.
 */
export default function useBookmarkedEvents({ ndk, bookmarkTags }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const instance = ndk?.current;
    if (!instance) {
      setEvents([]);
      setLoading(false);
      return;
    }
    if (!bookmarkTags?.length) {
      setEvents([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const tags = bookmarkTags.filter(t => Array.isArray(t) && t.length >= 2);
      const results = await Promise.all(
        tags.map(async t => {
          try {
            if (t[0] === "e" && t[1]) {
              const ev = await instance.fetchEvent({ ids: [t[1]], limit: 1 }, { closeOnEose: true });
              return ev?.rawEvent() ?? null;
            }
            if (t[0] === "a" && t[1]) {
              const addr = parseAddressTag(t[1]);
              if (!addr || addr.kind !== 30023) return null;
              const ev = await instance.fetchEvent(
                { kinds: [30023], authors: [addr.pubkey], "#d": [addr.d], limit: 1 },
                { closeOnEose: true }
              );
              return ev?.rawEvent() ?? null;
            }
          } catch {
            return null;
          }
          return null;
        })
      );

      if (cancelled) return;

      const ordered = [];
      const seen = new Set();
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r?.id && !seen.has(r.id)) {
          seen.add(r.id);
          ordered.push(r);
        }
      }
      setEvents(ordered);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [ndk, bookmarkTags]);

  return { events, loading };
}
