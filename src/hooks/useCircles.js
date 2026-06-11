import { useState, useEffect, useCallback, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

const CIRCLE_KIND = 30000;

function hasNip44() {
  return (
    typeof window !== "undefined" &&
    typeof window.nostr?.nip44?.encrypt === "function" &&
    typeof window.nostr?.nip44?.decrypt === "function"
  );
}

function randomId() {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return `circl_${hex}`;
}

export default function useCircles({ pubkey, signAndPublish } = {}) {
  const [circles, setCircles] = useState([]);
  const circlesRef = useRef([]);
  useEffect(() => { circlesRef.current = circles; }, [circles]);

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) { setCircles([]); return; }

    let cancelled = false;
    setCircles([]);
    const received = [];

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;

    const sub = pool.request(relayUrls, [{ kinds: [CIRCLE_KIND], authors: [pk] }]).subscribe({
      next: raw => { eventStore.add(raw); received.push(raw); },
      complete: async () => {
        if (cancelled) return;

        // Group by d tag, keep latest per id
        const byId = new Map();
        for (const ev of received) {
          const d = ev.tags?.find(t => t[0] === "d")?.[1];
          if (!d || !d.startsWith("circl_")) continue;
          const existing = byId.get(d);
          if (!existing || ev.created_at > existing.created_at) byId.set(d, ev);
        }

        const parsed = [];
        for (const [id, ev] of byId) {
          const titleTag = ev.tags?.find(t => t[0] === "title");
          const title = titleTag?.[1] ?? "Untitled Circle";

          // Skip deleted circles
          if (ev.tags?.some(t => t[0] === "deleted")) continue;

          let members = [];
          let decryptionFailed = false;
          const content = (ev.content || "").trim();
          if (content && hasNip44()) {
            try {
              const plain = await window.nostr.nip44.decrypt(ev.pubkey, ev.content);
              const arr = JSON.parse(plain);
              if (Array.isArray(arr)) {
                members = arr
                  .filter(x => typeof x === "string" && isHexPubkey(normPubkey(x)))
                  .map(normPubkey);
              }
            } catch {
              decryptionFailed = true;
            }
          } else if (content && !hasNip44()) {
            decryptionFailed = true;
          }
          // Fallback: public p tags (only when no encrypted content)
          if (!decryptionFailed) {
            for (const t of ev.tags || []) {
              if (t[0] === "p" && isHexPubkey(normPubkey(t[1]))) {
                const norm = normPubkey(t[1]);
                if (!members.includes(norm)) members.push(norm);
              }
            }
          }

          parsed.push({ id, title, members, decryptionFailed, event: ev });
        }

        if (!cancelled) setCircles(parsed);
      },
      error: () => { if (!cancelled) setCircles([]); },
    });

    return () => {
      cancelled = true;
      sub.unsubscribe();
    };
  }, [pubkey]);

  const persist = useCallback(
    async ({ id, title, members, deleted = false }) => {
      const pk = normPubkey(pubkey);
      if (!signAndPublish || !isHexPubkey(pk)) throw new Error("Sign in to manage circles");
      if (!hasNip44()) throw new Error("Your signer does not support NIP-44 (update the extension)");
      const tags = [["d", id], ["title", title]];
      if (deleted) tags.push(["deleted"]);
      const ciphertext = deleted
        ? await window.nostr.nip44.encrypt(pk, JSON.stringify([]))
        : await window.nostr.nip44.encrypt(pk, JSON.stringify(members));
      await signAndPublish({ kind: CIRCLE_KIND, content: ciphertext, tags });
    },
    [signAndPublish, pubkey]
  );

  const createCircle = useCallback(
    async title => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const id = randomId();
      const next = [...circlesRef.current, { id, title: trimmed, members: [] }];
      circlesRef.current = next;
      setCircles(next);
      try {
        await persist({ id, title: trimmed, members: [] });
      } catch (e) {
        circlesRef.current = circlesRef.current.filter(c => c.id !== id);
        setCircles(circlesRef.current);
        throw e;
      }
    },
    [persist]
  );

  const renameCircle = useCallback(
    async (id, newTitle) => {
      const trimmed = newTitle.trim();
      if (!trimmed) return;
      const prev = circlesRef.current;
      const circle = prev.find(c => c.id === id);
      if (!circle) return;
      const next = prev.map(c => c.id === id ? { ...c, title: trimmed } : c);
      circlesRef.current = next;
      setCircles(next);
      try {
        await persist({ id, title: trimmed, members: circle.members });
      } catch (e) {
        circlesRef.current = prev;
        setCircles(prev);
        throw e;
      }
    },
    [persist]
  );

  const deleteCircle = useCallback(
    async id => {
      const prev = circlesRef.current;
      const circle = prev.find(c => c.id === id);
      if (!circle) return;
      const next = prev.filter(c => c.id !== id);
      circlesRef.current = next;
      setCircles(next);
      try {
        await persist({ id, title: circle.title, members: [], deleted: true });
      } catch (e) {
        circlesRef.current = prev;
        setCircles(prev);
        throw e;
      }
    },
    [persist]
  );

  const addMember = useCallback(
    async (id, targetPk) => {
      const norm = normPubkey(targetPk);
      if (!isHexPubkey(norm)) return;
      const prev = circlesRef.current;
      const circle = prev.find(c => c.id === id);
      if (!circle || circle.members.includes(norm)) return;
      const updated = { ...circle, members: [...circle.members, norm] };
      const next = prev.map(c => c.id === id ? updated : c);
      circlesRef.current = next;
      setCircles(next);
      try {
        await persist(updated);
      } catch (e) {
        circlesRef.current = prev;
        setCircles(prev);
        throw e;
      }
    },
    [persist]
  );

  const removeMember = useCallback(
    async (id, targetPk) => {
      const norm = normPubkey(targetPk);
      const prev = circlesRef.current;
      const circle = prev.find(c => c.id === id);
      if (!circle) return;
      const updated = { ...circle, members: circle.members.filter(pk => pk !== norm) };
      const next = prev.map(c => c.id === id ? updated : c);
      circlesRef.current = next;
      setCircles(next);
      try {
        await persist(updated);
      } catch (e) {
        circlesRef.current = prev;
        setCircles(prev);
        throw e;
      }
    },
    [persist]
  );

  const isInCircle = useCallback(
    (id, targetPk) => {
      if (!targetPk) return false;
      const norm = normPubkey(targetPk);
      const circle = circlesRef.current.find(c => c.id === id);
      return circle?.members.includes(norm) ?? false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [circles]
  );

  return { circles, createCircle, renameCircle, deleteCircle, addMember, removeMember, isInCircle };
}
