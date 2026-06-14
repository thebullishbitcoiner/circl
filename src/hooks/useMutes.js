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
  const [muteEvent, setMuteEvent] = useState(null);
  const mutesRef = useRef([]);
  useEffect(() => { mutesRef.current = mutes; }, [mutes]);
  // true when we found existing encrypted content we couldn't read — block publishing to avoid data loss
  const unreadableRef = useRef(false);

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) { setMutes([]); unreadableRef.current = false; return; }

    let cancelled = false;
    unreadableRef.current = false;
    setMutes([]);
    setMuteEvent(null);
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
        let decryptFailed = false;
        const content = (latest.content || "").trim();
        // On mobile, the signer may not be injected yet at EOSE — wait up to 3 s
        if (content && !hasNip44()) {
          for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 500));
            if (cancelled || hasNip44()) break;
          }
        }
        if (cancelled) return;
        if (content && hasNip44()) {
          try {
            const plain = await window.nostr.nip44.decrypt(latest.pubkey, latest.content);
            const parsed = JSON.parse(plain);
            if (Array.isArray(parsed)) {
              pubkeys = parsed.filter(pk => typeof pk === "string" && isHexPubkey(normPubkey(pk))).map(normPubkey);
            }
          } catch {
            decryptFailed = true;
          }
        } else if (content && !hasNip44()) {
          decryptFailed = true;
        }
        // Public "p" tags fallback (only when no encrypted content was found)
        if (!decryptFailed) {
          for (const t of latest.tags || []) {
            if (t[0] === "p" && isHexPubkey(normPubkey(t[1]))) {
              const norm = normPubkey(t[1]);
              if (!pubkeys.includes(norm)) pubkeys.push(norm);
            }
          }
        }
        if (!cancelled) {
          // If we found content we can't read, block any future publish to avoid overwriting foreign data
          unreadableRef.current = decryptFailed;
          setMutes(pubkeys);
          setMuteEvent(latest);
        }
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

  return { mutes, muteEvent, mute, unmute, isMuted, toggleMute };
}
