import { useState, useEffect, useCallback, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore, relayUrls$ } from "../nostr.js";

const EMOJI_LIST_KIND = 10030;
const EMOJI_SET_KIND  = 30030;
const CACHE_KEY = "circl_custom_emoji";

function hasNip44() {
  return (
    typeof window !== "undefined" &&
    typeof window.nostr?.nip44?.encrypt === "function" &&
    typeof window.nostr?.nip44?.decrypt === "function"
  );
}

function readCache(pk) {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY))?.[pk] ?? null; } catch { return null; }
}
function writeCache(pk, emojis, sets, created_at) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
    store[pk] = { created_at, emojis, sets };
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}

export default function useCustomEmojiList({ pubkey, signAndPublish } = {}) {
  const cached0 = readCache(normPubkey(pubkey));
  const [emojis,  setEmojis]  = useState(cached0?.emojis ?? []);  // individual ["emoji"] tags
  const [sets,    setSets]    = useState(cached0?.sets ?? []);    // resolved bookmarked sets [{aTag,title,emojis}]
  const [loading, setLoading] = useState(false);

  const emojisRef    = useRef(emojis);
  const setsRef      = useRef(sets);
  // Gates publish() until the initial relay fetch (+ decrypt) has resolved, so a mutation
  // fired before load can't publish a list containing only the new item and wipe the rest.
  const settledRef   = useRef(!!cached0);
  useEffect(() => { emojisRef.current = emojis; }, [emojis]);
  useEffect(() => { setsRef.current   = sets;   }, [sets]);

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) { setEmojis([]); setSets([]); settledRef.current = false; return; }

    settledRef.current = false;
    let cancelled = false;
    setLoading(true);

    // Restore from cache immediately so a transient decrypt hiccup (or the
    // relay round-trip itself) never has to fall back to an empty list.
    const cached = readCache(pk);
    if (cached) {
      setEmojis(cached.emojis ?? []);
      setSets(cached.sets ?? []);
    } else {
      setEmojis([]);
      setSets([]);
    }

    const received = [];
    let listSettled = false;
    let bgRetryCount = 0;
    let cleanupSetSub = null;
    // Declared before subscribing (and accessed only via optional chaining)
    // so finishList() can't hit a not-yet-initialized reference in the
    // unlikely case a relay group completes synchronously.
    let listSub = null;
    let listCutoff = null;

    // pool.group(relayUrls$, false) bypasses ignoreOffline (so relays still
    // mid-handshake right after login aren't silently skipped) and
    // re-queries automatically as more relays connect.
    listSub = pool.group(relayUrls$, false).request([{ kinds: [EMOJI_LIST_KIND], authors: [pk] }]).subscribe({
      next: raw => { if (raw.kind !== EMOJI_LIST_KIND) return; eventStore.add(raw); received.push(raw); },
      complete: () => finishList(),
      error: () => finishList(),
    });

    // Runs once, on whichever comes first: the request completing (real
    // EOSE-based answer, possibly empty) or the cutoff timer below. This
    // hook previously had no cutoff at all, so a request that silently
    // reached zero relays (e.g. right after login) left `loading` stuck
    // true forever with no recovery.
    listCutoff = setTimeout(() => finishList(), 8000);

    async function finishList() {
      if (cancelled || listSettled) return;
      listSettled = true;
      if (listCutoff) clearTimeout(listCutoff);
      listSub?.unsubscribe();

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
      let decryptFailed = false;
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
            else decryptFailed = true;
          } catch { decryptFailed = true; }
        } else {
          decryptFailed = true;
        }
      }

      if (decryptFailed) {
        // Signer may still be warming up (common on mobile) — self-heal with
        // a couple of delayed background retries instead of showing an empty
        // list. Unconditionally returns either way: a failed decrypt must
        // never fall through to publish an empty/wrong list over cached state
        // (that's how a transient hiccup could permanently wipe a real,
        // still-encrypted-but-undecryptable list from relays on next edit).
        settledRef.current = true;
        if (!cancelled && bgRetryCount < 2) {
          bgRetryCount++;
          listSettled = false;
          setTimeout(() => { if (!cancelled) finishList(); }, 5000);
        }
        return;
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
        if (!cancelled) {
          setSets([]);
          writeCache(pk, parsedEmojis, [], latest.created_at);
          settledRef.current = true;
          setLoading(false);
        }
        return;
      }

      // fetch the actual set events
      const setFilters = aTags.map(aTag => {
        const parts = aTag.split(":");
        return { kinds: [EMOJI_SET_KIND], authors: [parts[1]], "#d": [parts[2]] };
      });

      const setEvents = [];
      let setsSettled = false;
      let setSub = null;
      let setsCutoff = null;

      setSub = pool.group(relayUrls$, false).request(setFilters).subscribe({
        next: raw => { if (raw.kind !== EMOJI_SET_KIND) return; eventStore.add(raw); setEvents.push(raw); },
        complete: () => finishSets(),
        error: () => finishSets(),
      });
      setsCutoff = setTimeout(() => finishSets(), 8000);

      function finishSets() {
        if (cancelled || setsSettled) return;
        setsSettled = true;
        if (setsCutoff) clearTimeout(setsCutoff);
        setSub?.unsubscribe();

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
        setSets(resolved);
        writeCache(pk, parsedEmojis, resolved, latest.created_at);
        settledRef.current = true;
        setLoading(false);
      }

      // store cleanup ref so outer cleanup can reach it
      cleanupSetSub = () => { if (setsCutoff) clearTimeout(setsCutoff); setSub?.unsubscribe(); };
    }

    return () => {
      cancelled = true;
      if (listCutoff) clearTimeout(listCutoff);
      listSub?.unsubscribe();
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
