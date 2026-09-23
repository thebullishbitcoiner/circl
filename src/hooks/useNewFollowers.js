import { useState, useEffect } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";

const REFRESH_MS = 20 * 60 * 1000; // poll on mount, then every 20 min
const STORAGE_KEY = "circl_known_followers_v1";

// null = never initialized for this pubkey (first run, seed silently)
function readKnown(pk) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Array.isArray(all[pk]) ? new Set(all[pk]) : null;
  } catch { return null; }
}

function writeKnown(pk, knownSet) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all[pk] = [...knownSet];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export default function useNewFollowers({ pubkey }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const me = normPubkey(pubkey);
    if (!isHexPubkey(me)) return;

    let cancelled = false;
    let known = readKnown(me); // Set<hex> | null

    function poll() {
      const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
      const latestByAuthor = new Map();

      const sub = pool.request(relayUrls, [{ kinds: [3], "#p": [me] }]).subscribe({
        next: raw => {
          eventStore.add(raw);
          const author = normPubkey(raw.pubkey);
          const prev = latestByAuthor.get(author);
          if (!prev || raw.created_at > prev.created_at) latestByAuthor.set(author, raw);
        },
        complete: () => {
          if (cancelled) return;
          const currentAuthors = [...latestByAuthor.keys()];

          if (known === null) {
            // First-ever check for this account: establish the baseline, don't notify.
            known = new Set(currentAuthors);
            writeKnown(me, known);
            return;
          }

          const newOnes = currentAuthors.filter(a => !known.has(a));
          if (newOnes.length) {
            setItems(prev => {
              const existingIds = new Set(prev.map(e => e.id));
              const fresh = newOnes
                .map(a => latestByAuthor.get(a))
                .filter(e => e && !existingIds.has(e.id));
              return fresh.length ? [...prev, ...fresh] : prev;
            });
          }

          for (const a of currentAuthors) known.add(a);
          writeKnown(me, known);
        },
      });
    }

    poll();
    const interval = setInterval(poll, REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [pubkey]);

  return { items };
}
