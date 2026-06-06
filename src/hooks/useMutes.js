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

export default function useMutes({ pubkey, signAndPublish } = {}) {
  const [mutes, setMutes] = useState([]);
  const mutesRef = useRef([]);
  useEffect(() => { mutesRef.current = mutes; }, [mutes]);

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) { setMutes([]); return; }

    let cancelled = false;
    setMutes([]);
    const received = [];

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;

    const sub = pool.request(relayUrls, [{ kinds: [MUTE_LIST_KIND], authors: [pk] }]).subscribe({
      next: raw => { eventStore.add(raw); received.push(raw); },
      complete: async () => {
        if (cancelled) return;
        const latest =
          received.length === 0
            ? null
            : [...received].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];

        if (!latest) { if (!cancelled) setMutes([]); return; }

        let pubkeys = [];
        const content = (latest.content || "").trim();
        if (content && hasNip44()) {
          try {
            const plain = await window.nostr.nip44.decrypt(latest.pubkey, latest.content);
            const parsed = JSON.parse(plain);
            if (Array.isArray(parsed)) {
              pubkeys = parsed.filter(pk => typeof pk === "string" && isHexPubkey(normPubkey(pk))).map(normPubkey);
            }
          } catch {}
        }
        // Also include any public "p" tags as fallback
        for (const t of latest.tags || []) {
          if (t[0] === "p" && isHexPubkey(normPubkey(t[1]))) {
            const norm = normPubkey(t[1]);
            if (!pubkeys.includes(norm)) pubkeys.push(norm);
          }
        }
        if (!cancelled) setMutes(pubkeys);
      },
      error: () => { if (!cancelled) setMutes([]); },
    });

    return () => {
      cancelled = true;
      sub.unsubscribe();
    };
  }, [pubkey]);

  const persist = useCallback(
    async nextMutes => {
      const pk = normPubkey(pubkey);
      if (!signAndPublish || !isHexPubkey(pk)) throw new Error("Sign in to update mute list");
      if (!hasNip44()) throw new Error("Your wallet does not support NIP-44 (update the extension)");
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
      const next = prev.filter(pk => pk !== norm);
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

  return { mutes, mute, unmute, isMuted, toggleMute };
}
