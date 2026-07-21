import { useState, useEffect } from "react";
import { isHexPubkey, hasNip44, hasNip04, decryptListContent } from "../utils.js";
import { pool, eventStore, relayUrls$ } from "../nostr.js";

// Reads a NIP-51 "standard list" of relays for the given kind (10007 search,
// 10006 blocked, 10013 private, ...). Public entries live as ["relay", url]
// tags; private entries live NIP-44-encrypted in content as a stringified
// array of the same tag shape.
// Returns [{url: string, source: "public"|"encrypted"}]
export default function useRelayList(pubkey, kind) {
  const [relays, setRelays] = useState([]);

  useEffect(() => {
    if (!pubkey || !isHexPubkey(pubkey) || !kind) {
      setRelays([]);
      return;
    }

    let cancelled = false;
    let generation = 0;
    let latestEvent = null;
    let processTimer = null;
    let resolved = false;

    const process = async () => {
      if (cancelled || !latestEvent) return;
      const gen = ++generation;
      const ev = latestEvent;

      const seen = new Set();
      const all = [];

      // Public relay tags first
      for (const t of ev.tags || []) {
        if (t[0] === "relay" && typeof t[1] === "string" && !seen.has(t[1])) {
          seen.add(t[1]);
          all.push({ url: t[1], source: "public" });
        }
      }

      const content = (ev.content || "").trim();
      if (content) {
        if (!hasNip44() && !hasNip04()) {
          for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 500));
            if (cancelled || hasNip44() || hasNip04()) break;
          }
        }
        if (!cancelled && generation === gen) {
          const plain = await decryptListContent(ev.pubkey, content);
          if (plain) {
            try {
              const parsed = JSON.parse(plain);
              if (Array.isArray(parsed)) {
                for (const t of parsed) {
                  if (Array.isArray(t) && t[0] === "relay" && typeof t[1] === "string" && !seen.has(t[1])) {
                    seen.add(t[1]);
                    all.push({ url: t[1], source: "encrypted" });
                  }
                }
              }
            } catch {}
          }
        }
      }

      if (!cancelled && generation === gen) { setRelays(all); resolved = true; }
    };

    const sub = pool.group(relayUrls$, false).subscription([{ kinds: [kind], authors: [pubkey] }]).subscribe({
      next: raw => {
        if (raw.kind !== kind) return;
        eventStore.add(raw);
        if (!cancelled && raw.created_at > (latestEvent?.created_at ?? 0)) {
          latestEvent = raw;
          clearTimeout(processTimer);
          processTimer = setTimeout(process, 300);
        }
      },
      // Only show empty on a subscription error if we never resolved a real
      // answer at all — a relay disconnecting *after* successfully
      // delivering the list (normal for a long-lived subscription) must not
      // clobber data that's already loaded and showing.
      error: () => { if (!cancelled && !resolved) setRelays([]); },
    });

    const cutoffTimer = setTimeout(() => {
      sub.unsubscribe();
      // Only reprocess if we haven't already resolved a real answer —
      // otherwise this redundantly re-emits a new (but content-identical)
      // `relays` array for no reason.
      if (!resolved) process();
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(processTimer);
      clearTimeout(cutoffTimer);
      sub.unsubscribe();
    };
  }, [pubkey, kind]);

  return relays;
}
