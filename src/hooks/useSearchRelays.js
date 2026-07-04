import { useState, useEffect } from "react";
import { isHexPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

function hasNip44() {
  return typeof window !== "undefined" &&
    typeof window.nostr?.nip44?.encrypt === "function" &&
    typeof window.nostr?.nip44?.decrypt === "function";
}

function hasNip04() {
  return typeof window !== "undefined" &&
    typeof window.nostr?.nip04?.decrypt === "function";
}

export default function useSearchRelays(pubkey) {
  const [relays, setRelays] = useState([]);

  useEffect(() => {
    if (!pubkey || !isHexPubkey(pubkey)) {
      setRelays([]);
      return;
    }

    let cancelled = false;
    let generation = 0;
    let latestEvent = null;
    let processTimer = null;

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;

    const process = async () => {
      if (cancelled || !latestEvent) return;
      const gen = ++generation;
      const ev = latestEvent;

      // Always collect public relay tags first
      const seen = new Set();
      const all = [];
      const push = url => { if (url && !seen.has(url)) { seen.add(url); all.push(url); } };
      for (const t of ev.tags || []) {
        if (t[0] === "relay" && typeof t[1] === "string") push(t[1]);
      }

      const content = (ev.content || "").trim();
      if (content) {
        // Wait up to 3s for signer on mobile
        if (!hasNip44() && !hasNip04()) {
          for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 500));
            if (cancelled || hasNip44() || hasNip04()) break;
          }
        }
        if (!cancelled && generation === gen) {
          let plain = null;
          // NIP-51: detect encryption by presence of "?iv=" (NIP-04) vs its absence (NIP-44)
          const looksLikeNip04 = content.includes("?iv=");
          if (looksLikeNip04) {
            if (hasNip04()) try { plain = await window.nostr.nip04.decrypt(ev.pubkey, content); } catch {}
            if (!plain && hasNip44()) try { plain = await window.nostr.nip44.decrypt(ev.pubkey, content); } catch {}
          } else {
            if (hasNip44()) try { plain = await window.nostr.nip44.decrypt(ev.pubkey, content); } catch {}
            if (!plain && hasNip04()) try { plain = await window.nostr.nip04.decrypt(ev.pubkey, content); } catch {}
          }
          if (plain) {
            try {
              const parsed = JSON.parse(plain);
              if (Array.isArray(parsed)) {
                for (const t of parsed) {
                  if (Array.isArray(t) && t[0] === "relay" && typeof t[1] === "string") push(t[1]);
                }
              }
            } catch {}
          }
        }
      }

      if (!cancelled && generation === gen) setRelays(all);
    };

    const sub = pool.subscription(relayUrls, [{ kinds: [10007], authors: [pubkey] }]).subscribe({
      next: raw => {
        eventStore.add(raw);
        if (!cancelled && raw.created_at > (latestEvent?.created_at ?? 0)) {
          latestEvent = raw;
          clearTimeout(processTimer);
          processTimer = setTimeout(process, 300);
        }
      },
      error: () => { if (!cancelled) setRelays([]); },
    });

    const cutoffTimer = setTimeout(() => { sub.unsubscribe(); process(); }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(processTimer);
      clearTimeout(cutoffTimer);
      sub.unsubscribe();
    };
  }, [pubkey]);

  return relays;
}
