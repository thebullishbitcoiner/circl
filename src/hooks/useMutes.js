import { useState, useEffect, useCallback, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

const MUTE_LIST_KIND = 10000;

function hasNip44() {
  return (
    typeof window !== "undefined" &&
    typeof window.nostr?.nip44?.encrypt === "function" &&
    typeof window.nostr?.nip44?.decrypt === "function"
  );
}

// Persists decrypted output across remounts so navigation doesn't flash empty
const _cache = new Map(); // pk → { mutes, muteEvent }

export default function useMutes({ pubkey, signAndPublish } = {}) {
  const [mutes, setMutes] = useState(() => {
    const pk = normPubkey(pubkey);
    return isHexPubkey(pk) ? (_cache.get(pk)?.mutes ?? []) : [];
  });
  const [muteEvent, setMuteEvent] = useState(() => {
    const pk = normPubkey(pubkey);
    return isHexPubkey(pk) ? (_cache.get(pk)?.muteEvent ?? null) : null;
  });
  const mutesRef = useRef([]);
  useEffect(() => { mutesRef.current = mutes; }, [mutes]);
  // true when we found existing encrypted content we couldn't read — block publishing to avoid data loss
  const unreadableRef = useRef(false);

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) { setMutes([]); unreadableRef.current = false; return; }

    let cancelled = false;
    let generation = 0;
    unreadableRef.current = false;
    // Only wipe visible state if we have nothing cached to show while re-fetching
    if (!_cache.has(pk)) { setMutes([]); setMuteEvent(null); }
    let latestEvent = null;
    let processTimer = null;

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;

    const process = async () => {
      if (cancelled || !latestEvent) return;
      const gen = ++generation;
      const ev = latestEvent;

      let pubkeys = [];
      let decryptFailed = false;
      const content = (ev.content || "").trim();
      // On mobile, the signer may not be injected yet — wait up to 3 s
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
          if (Array.isArray(parsed)) {
            pubkeys = parsed.filter(p => typeof p === "string" && isHexPubkey(normPubkey(p))).map(normPubkey);
          }
        } catch {
          decryptFailed = true;
        }
      } else if (content) {
        decryptFailed = true;
      }
      // Public "p" tags fallback (only when no encrypted content was found)
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
        setMuteEvent(ev);
        if (!decryptFailed) _cache.set(pk, { mutes: pubkeys, muteEvent: ev });
      }
    };

    // Seed from eventStore immediately — no relay round-trip needed on remount
    try {
      const stored = eventStore.getTimeline([{ kinds: [MUTE_LIST_KIND], authors: [pk], limit: 1 }])?.[0];
      if (stored) { latestEvent = stored; processTimer = setTimeout(process, 0); }
    } catch {}

    // Use subscription (not request) so events arriving after EOSE aren't dropped
    const sub = pool.subscription(relayUrls, [{ kinds: [MUTE_LIST_KIND], authors: [pk] }]).subscribe({
      next: raw => {
        eventStore.add(raw);
        if (!cancelled && (!latestEvent || raw.created_at > latestEvent.created_at)) {
          latestEvent = raw;
          clearTimeout(processTimer);
          processTimer = setTimeout(process, 300);
        }
      },
      error: () => { if (!cancelled) setMutes([]); },
    });

    // Hard cutoff: process whatever we have and close
    const cutoffTimer = setTimeout(() => { sub.unsubscribe(); process(); }, 8000);

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
      try {
        await persist(next);
      } catch (e) {
        mutesRef.current = prev;
        setMutes(prev);
        throw e;
      }
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
      try {
        await persist(next);
      } catch (e) {
        mutesRef.current = prev;
        setMutes(prev);
        throw e;
      }
    },
    [persist]
  );

  const isMuted = useCallback(
    targetPk => {
      if (!targetPk) return false;
      const norm = normPubkey(targetPk);
      return mutesRef.current.includes(norm);
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
