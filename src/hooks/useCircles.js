import { useState, useEffect, useCallback, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore, relayUrls$ } from "../nostr.js";

const CIRCLE_KIND = 30000;
const CACHE_KEY = "circl_circles";

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

// Cache stores decrypted circle data per account, keyed by d-tag.
// Shape: { [pk]: { [d]: { created_at, title, members } } }
function readCache(pk) {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY))?.[pk] ?? null; } catch { return null; }
}
function writeCache(pk, byId) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
    store[pk] = byId;
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}

function cacheToCircles(byId) {
  return Object.entries(byId)
    .filter(([, v]) => !v.deleted)
    .map(([id, v]) => ({ id, title: v.title, members: v.members, decryptionFailed: false }));
}

export default function useCircles({ pubkey, signAndPublish } = {}) {
  const [circles, setCircles] = useState(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) return [];
    const cached = readCache(pk);
    return cached ? cacheToCircles(cached) : [];
  });
  const circlesRef = useRef(circles);
  useEffect(() => { circlesRef.current = circles; }, [circles]);
  const settledRef = useRef(!!readCache(normPubkey(pubkey)));

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) { setCircles([]); return; }

    let cancelled = false;
    let generation = 0;

    // Restore from decrypted cache immediately — no relay round-trip or crypto needed
    const cached = readCache(pk);
    // byId tracks the best event seen per d-tag (for relay comparison)
    // Values: { created_at, title, members, deleted }
    const byId = cached ? { ...cached } : {};
    if (cached) setCircles(cacheToCircles(cached));
    else setCircles([]);

    let processTimer = null;

    const process = async () => {
      if (cancelled || Object.keys(byId).length === 0) return;
      const gen = ++generation;

      // On mobile the signer may not be injected yet — wait up to 3 s
      const needsDecrypt = Object.values(byId).some(v => v._raw);
      if (needsDecrypt && !hasNip44()) {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 500));
          if (cancelled || hasNip44()) break;
        }
      }
      if (cancelled || generation !== gen) return;

      let changed = false;
      for (const [id, entry] of Object.entries(byId)) {
        if (!entry._raw) continue; // already decoded from cache
        const ev = entry._raw;
        const titleTag = ev.tags?.find(t => t[0] === "title");
        const title = titleTag?.[1] ?? "Untitled Circle";
        const deleted = ev.tags?.some(t => t[0] === "deleted") ?? false;

        let members = [];
        let decryptionFailed = false;
        const content = (ev.content || "").trim();
        if (content && hasNip44()) {
          try {
            const plain = await window.nostr.nip44.decrypt(ev.pubkey, ev.content);
            const arr = JSON.parse(plain);
            if (Array.isArray(arr))
              members = arr.filter(x => typeof x === "string" && isHexPubkey(normPubkey(x))).map(normPubkey);
          } catch { decryptionFailed = true; }
        } else if (content) {
          decryptionFailed = true;
        }
        if (!decryptionFailed) {
          for (const t of ev.tags || []) {
            if (t[0] === "p" && isHexPubkey(normPubkey(t[1]))) {
              const norm = normPubkey(t[1]);
              if (!members.includes(norm)) members.push(norm);
            }
          }
        }

        if (!decryptionFailed) {
          byId[id] = { created_at: ev.created_at, title, members, deleted };
          changed = true;
        }
        if (cancelled || generation !== gen) return;
      }

      if (!cancelled && generation === gen) {
        if (changed) writeCache(pk, byId);
        const next = cacheToCircles(byId);
        setCircles(next);
        circlesRef.current = next;
        settledRef.current = true;
      }
    };

    const ingestRaw = raw => {
      const d = raw.tags?.find(t => t[0] === "d")?.[1];
      if (!d || !d.startsWith("circl_")) return false;
      const existing = byId[d];
      if (existing && raw.created_at <= existing.created_at) return false;
      // Store raw event for decryption; _raw is stripped before caching
      byId[d] = { created_at: raw.created_at, _raw: raw };
      return true;
    };

    const sub = pool.group(relayUrls$, false).subscription([{ kinds: [CIRCLE_KIND], authors: [pk] }]).subscribe({
      next: raw => {
        if (raw.kind !== CIRCLE_KIND) return;
        eventStore.add(raw);
        if (!cancelled && ingestRaw(raw)) {
          clearTimeout(processTimer);
          processTimer = setTimeout(process, 300);
        }
      },
      error: () => { if (!cancelled && !cached) setCircles([]); },
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
    async ({ id, title, members, deleted = false }) => {
      const pk = normPubkey(pubkey);
      if (!signAndPublish || !isHexPubkey(pk)) throw new Error("Sign in to manage circles");
      if (!hasNip44()) throw new Error("Your signer does not support NIP-44 (update the extension)");
      if (!settledRef.current) throw new Error("Circles are still syncing from relays, please try again in a moment");
      const tags = [["d", id], ["title", title]];
      if (deleted) tags.push(["deleted"]);
      const ciphertext = deleted
        ? await window.nostr.nip44.encrypt(pk, JSON.stringify([]))
        : await window.nostr.nip44.encrypt(pk, JSON.stringify(members));
      await signAndPublish({ kind: CIRCLE_KIND, content: ciphertext, tags });
      // Update cache immediately with the new state
      try {
        const store = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
        const pkCache = store[pk] ?? {};
        pkCache[id] = { created_at: Math.floor(Date.now() / 1000), title, members, deleted };
        store[pk] = pkCache;
        localStorage.setItem(CACHE_KEY, JSON.stringify(store));
      } catch {}
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
      } catch (e) { circlesRef.current = prev; setCircles(prev); throw e; }
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
      } catch (e) { circlesRef.current = prev; setCircles(prev); throw e; }
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
      } catch (e) { circlesRef.current = prev; setCircles(prev); throw e; }
    },
    [persist]
  );

  const removeMember = useCallback(
    async (id, targetPk) => {
      const norm = normPubkey(targetPk);
      const prev = circlesRef.current;
      const circle = prev.find(c => c.id === id);
      if (!circle) return;
      const updated = { ...circle, members: circle.members.filter(p => p !== norm) };
      const next = prev.map(c => c.id === id ? updated : c);
      circlesRef.current = next;
      setCircles(next);
      try {
        await persist(updated);
      } catch (e) { circlesRef.current = prev; setCircles(prev); throw e; }
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
