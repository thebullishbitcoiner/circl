import { useState, useEffect, useCallback, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";

const EMOJI_LIST_KIND = 10030;
const EMOJI_SET_KIND  = 30030;

function hasNip44() {
  return (
    typeof window !== "undefined" &&
    typeof window.nostr?.nip44?.encrypt === "function" &&
    typeof window.nostr?.nip44?.decrypt === "function"
  );
}

export default function useCustomEmojiList({ pubkey, signAndPublish } = {}) {
  const [emojis,  setEmojis]  = useState([]);  // individual ["emoji"] tags
  const [sets,    setSets]    = useState([]);  // resolved bookmarked sets [{aTag,title,emojis}]
  const [loading, setLoading] = useState(false);

  const emojisRef    = useRef([]);
  const setsRef      = useRef([]);
  // Gates publish() until the initial relay fetch (+ decrypt) has resolved, so a mutation
  // fired before load can't publish a list containing only the new item and wipe the rest.
  const settledRef   = useRef(false);
  useEffect(() => { emojisRef.current = emojis; }, [emojis]);
  useEffect(() => { setsRef.current   = sets;   }, [sets]);

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) { setEmojis([]); setSets([]); return; }

    settledRef.current = false;
    let cancelled = false;
    setLoading(true);
    setEmojis([]);
    setSets([]);

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
    const received  = [];

    const sub = pool.request(relayUrls, [{ kinds: [EMOJI_LIST_KIND], authors: [pk] }]).subscribe({
      next: raw => { eventStore.add(raw); received.push(raw); },
      complete: async () => {
        if (cancelled) return;

        // pick latest event
        let latest = null;
        for (const ev of received) {
          if (!latest || ev.created_at > latest.created_at) latest = ev;
        }

        if (!latest) { settledRef.current = true; setLoading(false); return; }

        // New format: tags are NIP-44 encrypted into content. Legacy events (published
        // before encryption was added) carry plaintext tags with empty content.
        let tags = latest.tags || [];
        const content = (latest.content || "").trim();
        if (content) {
          if (!hasNip44()) {
            // Signer may not be injected yet (common on mobile) — wait up to 3s
            for (let i = 0; i < 6; i++) {
              await new Promise(r => setTimeout(r, 500));
              if (cancelled || hasNip44()) break;
            }
          }
          if (cancelled) return;
          if (hasNip44()) {
            try {
              const plain = await window.nostr.nip44.decrypt(latest.pubkey, latest.content);
              const parsed = JSON.parse(plain);
              if (Array.isArray(parsed)) tags = parsed;
            } catch { /* leave tags empty on decrypt failure */ }
          }
        }

        // individual emojis
        const parsedEmojis = tags
          .filter(t => t[0] === "emoji" && t[1] && t[2])
          .map(t => ({ name: t[1], url: t[2] }));

        // bookmarked set a-tags: "30030:<pubkey>:<d>"
        const aTags = tags
          .filter(t => t[0] === "a" && typeof t[1] === "string" && t[1].startsWith(`${EMOJI_SET_KIND}:`))
          .map(t => t[1]);

        if (!cancelled) setEmojis(parsedEmojis);

        if (aTags.length === 0) {
          if (!cancelled) { setSets([]); settledRef.current = true; setLoading(false); }
          return;
        }

        // fetch the actual set events
        const setFilters = aTags.map(aTag => {
          const parts = aTag.split(":");
          return { kinds: [EMOJI_SET_KIND], authors: [parts[1]], "#d": [parts[2]] };
        });

        const setEvents = [];
        const setSub = pool.request(relayUrls, setFilters).subscribe({
          next: raw => { eventStore.add(raw); setEvents.push(raw); },
          complete: () => {
            if (cancelled) return;
            const resolved = aTags.map(aTag => {
              const parts = aTag.split(":");
              const setpk = parts[1], dTag = parts[2];
              const candidates = setEvents.filter(ev =>
                ev.pubkey === setpk && ev.tags?.find(t => t[0] === "d" && t[1] === dTag)
              );
              const ev = candidates.reduce((best, cur) =>
                (!best || cur.created_at > best.created_at) ? cur : best, null
              );
              if (!ev) return { aTag, title: dTag, emojis: [] };
              const title = ev.tags?.find(t => t[0] === "title")?.[1] ?? dTag;
              const setEmojis = [...new Map(
                (ev.tags || []).filter(t => t[0] === "emoji" && t[1] && t[2]).map(t => [t[1], { name: t[1], url: t[2] }])
              ).values()];
              return { aTag, title, emojis: setEmojis };
            });
            if (!cancelled) { setSets(resolved); settledRef.current = true; setLoading(false); }
          },
          error: () => { if (!cancelled) { settledRef.current = true; setLoading(false); } },
        });

        // store cleanup ref so outer cleanup can reach it
        cleanupSetSub = () => setSub.unsubscribe();
      },
      error: () => { if (!cancelled) { settledRef.current = true; setLoading(false); } },
    });

    let cleanupSetSub = null;
    return () => {
      cancelled = true;
      sub.unsubscribe();
      cleanupSetSub?.();
    };
  }, [pubkey]);

  // All emojis for the picker: individual first, then set emojis (skip name dupes)
  const allCustomEmojis = [
    ...emojis,
    ...sets.flatMap(s => s.emojis.filter(e => !emojis.some(ie => ie.name === e.name))),
  ];

  // ── publish helpers ──────────────────────────────────────────────────────────

  const publish = useCallback(async (nextEmojis, nextSets) => {
    const pk = normPubkey(pubkey);
    if (!signAndPublish || !isHexPubkey(pk)) throw new Error("Sign in to manage custom emoji");
    if (!hasNip44()) throw new Error("Your signer does not support NIP-44 (update the extension)");
    if (!settledRef.current) throw new Error("Custom emoji list is still syncing from relays, please try again in a moment");
    const tags = [
      ...nextEmojis.map(({ name, url }) => ["emoji", name, url]),
      ...nextSets.map(({ aTag }) => ["a", aTag]),
    ];
    const ciphertext = await window.nostr.nip44.encrypt(pk, JSON.stringify(tags));
    await signAndPublish({ kind: EMOJI_LIST_KIND, content: ciphertext, tags: [] });
  }, [signAndPublish, pubkey]);

  // ── individual emoji mutations ───────────────────────────────────────────────

  const addEmoji = useCallback(async (name, url) => {
    const trimName = name.trim(), trimUrl = url.trim();
    if (!trimName || !trimUrl) return;
    if (emojisRef.current.some(e => e.name === trimName)) return;
    const prev = emojisRef.current;
    const next = [...prev, { name: trimName, url: trimUrl }];
    emojisRef.current = next;
    setEmojis(next);
    try { await publish(next, setsRef.current); }
    catch (e) { emojisRef.current = prev; setEmojis(prev); throw e; }
  }, [publish]);

  const removeEmoji = useCallback(async (name) => {
    const prev = emojisRef.current;
    const next = prev.filter(e => e.name !== name);
    if (next.length === prev.length) return;
    emojisRef.current = next;
    setEmojis(next);
    try { await publish(next, setsRef.current); }
    catch (e) { emojisRef.current = prev; setEmojis(prev); throw e; }
  }, [publish]);

  // ── set mutations ────────────────────────────────────────────────────────────

  // setEvent is the raw kind 30030 event object
  const addSet = useCallback(async (setEvent) => {
    const dTag = setEvent.tags?.find(t => t[0] === "d")?.[1];
    if (!dTag) return;
    const aTag = `${EMOJI_SET_KIND}:${setEvent.pubkey}:${dTag}`;
    if (setsRef.current.some(s => s.aTag === aTag)) return;
    const title     = setEvent.tags?.find(t => t[0] === "title")?.[1] ?? dTag;
    const setEmojis = [...new Map(
      (setEvent.tags || []).filter(t => t[0] === "emoji" && t[1] && t[2]).map(t => [t[1], { name: t[1], url: t[2] }])
    ).values()];
    const newSet = { aTag, title, emojis: setEmojis };
    const prev = setsRef.current;
    const next = [...prev, newSet];
    setsRef.current = next;
    setSets(next);
    try { await publish(emojisRef.current, next); }
    catch (e) { setsRef.current = prev; setSets(prev); throw e; }
  }, [publish]);

  const removeSet = useCallback(async (aTag) => {
    const prev = setsRef.current;
    const next = prev.filter(s => s.aTag !== aTag);
    if (next.length === prev.length) return;
    setsRef.current = next;
    setSets(next);
    try { await publish(emojisRef.current, next); }
    catch (e) { setsRef.current = prev; setSets(prev); throw e; }
  }, [publish]);

  return { emojis, sets, allCustomEmojis, addEmoji, removeEmoji, addSet, removeSet, loading };
}
