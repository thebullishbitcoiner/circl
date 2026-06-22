import { useState, useEffect, useCallback, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

const MUTE_LIST_KIND = 10000;
const CACHE_KEY = "circl_mutes";

function hasNip44() {
  return (
    typeof window !== "undefined" &&
    typeof window.nostr?.nip44?.encrypt === "function" &&
    typeof window.nostr?.nip44?.decrypt === "function"
  );
}

// Cache stores decrypted pubkeys per account — no crypto needed on reload
function readCache(pk) {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY))?.[pk] ?? null; } catch { return null; }
}
function writeCache(pk, pubkeys, created_at) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
    store[pk] = { created_at, pubkeys };
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}

export default function useMutes({ pubkey, signAndPublish } = {}) {
  const [mutes, setMutes] = useState(() => {
    const pk = normPubkey(pubkey);
    return isHexPubkey(pk) ? (readCache(pk)?.pubkeys ?? []) : [];
  });
  const [muteEvent, setMuteEvent] = useState(null);
  const mutesRef = useRef(mutes);
  useEffect(() => { mutesRef.current = mutes; }, [mutes]);
  const unreadableRef = useRef(false);
  const settledRef = useRef(!!readCache(normPubkey(pubkey)));

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) { setMutes([]); unreadableRef.current = false; return; }

    let cancelled = false;
    let generation = 0;
    unreadableRef.current = false;

    // Restore from decrypted cache immediately — no relay round-trip or crypto needed
    const cached = readCache(pk);
    if (cached) {
      setMutes(cached.pubkeys);
    } else {
      setMutes([]);
      setMuteEvent(null);
    }

    // Track the best event seen; skip relay events older than what we have cached
    let latestEvent = null;
    let knownCreatedAt = cached?.created_at ?? 0;
    let processTimer = null;

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;

    const process = async () => {
      if (cancelled || !latestEvent) return;
      const gen = ++generation;
      const ev = latestEvent;

      let pubkeys = [];
      let decryptFailed = false;
      const content = (ev.content || "").trim();
      // On mobile the signer may not be injected yet — wait up to 3 s
      if (content && !hasNip44()) {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 500));
          if (cancelled || hasNip44()) break;
        }
      }
      if (cancelled || generation !== gen) return;
      if (content && hasNip44()) {
        try {
          const plain = await window.nostr.nip44.decrypt(ev.pubkey, ev.content);
          const parsed = JSON.parse(plain);
          if (Array.isArray(parsed))
            pubkeys = parsed.filter(p => typeof p === "string" && isHexPubkey(normPubkey(p))).map(normPubkey);
        } catch { decryptFailed = true; }
      } else if (content) {
        decryptFailed = true;
      }
      if (!decryptFailed) {
        for (const t of ev.tags || []) {
          if (t[0] === "p" && isHexPubkey(normPubkey(t[1]))) {
            const norm = normPubkey(t[1]);
            if (!pubkeys.includes(norm)) pubkeys.push(norm);
          }
        }
      }
      if (!cancelled && generation === gen) {
        unreadableRef.current = decryptFailed;
        setMutes(pubkeys);
        mutesRef.current = pubkeys;
        setMuteEvent(ev);
        if (!decryptFailed) {
          writeCache(pk, pubkeys, ev.created_at);
          knownCreatedAt = ev.created_at;
        }
        settledRef.current = true;
      }
    };

    const sub = pool.subscription(relayUrls, [{ kinds: [MUTE_LIST_KIND], authors: [pk] }]).subscribe({
      next: raw => {
        eventStore.add(raw);
        if (!cancelled && raw.created_at > Math.max(knownCreatedAt, latestEvent?.created_at ?? 0)) {
          latestEvent = raw;
          clearTimeout(processTimer);
          processTimer = setTimeout(process, 300);
        }
      },
      error: () => { if (!cancelled && !cached) setMutes([]); },
    });

    const cutoffTimer = setTimeout(() => { sub.unsubscribe(); settledRef.current = true; process(); }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(processTimer);
      clearTimeout(cutoffTimer);
      sub.unsubscribe();
    };
  }, [pubkey]);

  const persist = useCallback(
    async nextMutes => {
      const pk = normPubkey(pubkey);
      if (!signAndPublish || !isHexPubkey(pk)) throw new Error("Sign in to update mute list");
      if (!hasNip44()) throw new Error("Your wallet does not support NIP-44 (update the extension)");
      if (!settledRef.current) throw new Error("Mute list is still syncing from relays, please try again in a moment");
      if (unreadableRef.current) throw new Error("Existing mute list was created by a different signer and cannot be safely modified");
      const ciphertext = await window.nostr.nip44.encrypt(pk, JSON.stringify(nextMutes));
      await signAndPublish({ kind: MUTE_LIST_KIND, content: ciphertext, tags: [] });
    },
    [signAndPublish, pubkey]
  );

  const mute = useCallback(
    async targetPk => {
      const norm = normPubkey(targetPk);
      if (!isHexPubkey(norm)) return;
      const prev = mutesRef.current;
      if (prev.includes(norm)) return;
      const next = [...prev, norm];
      mutesRef.current = next;
      setMutes(next);
      try { await persist(next); } catch (e) { mutesRef.current = prev; setMutes(prev); throw e; }
    },
    [persist]
  );

  const unmute = useCallback(
    async targetPk => {
      const norm = normPubkey(targetPk);
      if (!isHexPubkey(norm)) return;
      const prev = mutesRef.current;
      const next = prev.filter(p => p !== norm);
      if (next.length === prev.length) return;
      mutesRef.current = next;
      setMutes(next);
      try { await persist(next); } catch (e) { mutesRef.current = prev; setMutes(prev); throw e; }
    },
    [persist]
  );

  const isMuted = useCallback(
    targetPk => {
      if (!targetPk) return false;
      return mutesRef.current.includes(normPubkey(targetPk));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutes]
  );

  const toggleMute = useCallback(
    async targetPk => {
      const norm = normPubkey(targetPk);
      if (mutesRef.current.includes(norm)) return unmute(targetPk);
      return mute(targetPk);
    },
    [mute, unmute]
  );

  return { mutes, muteEvent, mute, unmute, isMuted, toggleMute };
}
