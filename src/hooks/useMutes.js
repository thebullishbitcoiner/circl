import { useState, useEffect, useCallback, useRef } from "react";
import { isHexPubkey, normPubkey, hasNip44, hasNip04, decryptListContent } from "../utils.js";
import { pool, eventStore, relayUrls$ } from "../nostr.js";

const MUTE_LIST_KIND = 10000;
const CACHE_KEY = "circl_mutes";

function readCache(pk) {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY))?.[pk] ?? null; } catch { return null; }
}

function writeCache(pk, data, created_at) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
    store[pk] = { created_at, ...data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}

function parseMuteTags(tags) {
  const pubkeys = [], hashtags = [], words = [], threads = [];
  for (const t of tags) {
    if (!Array.isArray(t) || !t[1]) continue;
    if (t[0] === "p" && isHexPubkey(normPubkey(t[1]))) {
      const norm = normPubkey(t[1]);
      if (!pubkeys.includes(norm)) pubkeys.push(norm);
    } else if (t[0] === "t") {
      const norm = t[1].toLowerCase().replace(/^#/, "");
      if (norm && !hashtags.includes(norm)) hashtags.push(norm);
    } else if (t[0] === "word") {
      const norm = t[1].toLowerCase();
      if (norm && !words.includes(norm)) words.push(norm);
    } else if (t[0] === "e") {
      if (!threads.includes(t[1])) threads.push(t[1]);
    }
  }
  return { pubkeys, hashtags, words, threads };
}

function mergeUniq(a, b) {
  const out = [...a];
  for (const x of b) if (!out.includes(x)) out.push(x);
  return out;
}

export default function useMutes({ pubkey, signAndPublish } = {}) {
  const cached0 = readCache(normPubkey(pubkey));

  const [mutes, setMutes] = useState(cached0?.pubkeys ?? []);
  const [hashtags, setHashtags] = useState(cached0?.hashtags ?? []);
  const [words, setWords] = useState(cached0?.words ?? []);
  const [threads, setThreads] = useState(cached0?.threads ?? []);
  const [muteEvent, setMuteEvent] = useState(null);

  const mutesRef = useRef(mutes);
  const hashtagsRef = useRef(hashtags);
  const wordsRef = useRef(words);
  const threadsRef = useRef(threads);

  useEffect(() => { mutesRef.current = mutes; }, [mutes]);
  useEffect(() => { hashtagsRef.current = hashtags; }, [hashtags]);
  useEffect(() => { wordsRef.current = words; }, [words]);
  useEffect(() => { threadsRef.current = threads; }, [threads]);

  const unreadableRef = useRef(false);
  const settledRef = useRef(!!cached0);

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) {
      setMutes([]); setHashtags([]); setWords([]); setThreads([]);
      unreadableRef.current = false;
      return;
    }

    let cancelled = false;
    let generation = 0;
    unreadableRef.current = false;

    const cached = readCache(pk);
    if (cached) {
      setMutes(cached.pubkeys ?? []);
      setHashtags(cached.hashtags ?? []);
      setWords(cached.words ?? []);
      setThreads(cached.threads ?? []);
    } else {
      setMutes([]); setHashtags([]); setWords([]); setThreads([]);
      setMuteEvent(null);
    }

    let latestEvent = null;
    let knownCreatedAt = cached?.created_at ?? 0;
    let processTimer = null;
    let bgRetryCount = 0;

    const process = async () => {
      if (cancelled || !latestEvent) return;
      const gen = ++generation;
      const ev = latestEvent;

      let decryptFailed = false;
      const content = (ev.content || "").trim();

      if (content && !hasNip44() && !hasNip04()) {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 500));
          if (cancelled || hasNip44() || hasNip04()) break;
        }
      }
      if (cancelled || generation !== gen) return;

      let privateTags = [];
      if (content && (hasNip44() || hasNip04())) {
        const plain = await decryptListContent(ev.pubkey, content);
        if (plain) {
          try {
            const parsed = JSON.parse(plain);
            if (Array.isArray(parsed)) {
              if (parsed.length > 0 && Array.isArray(parsed[0])) {
                // NIP-51 standard: array of tag arrays [["p","..."], ["t","nostr"], ...]
                privateTags = parsed;
              } else {
                // Legacy Circl format: array of pubkey strings ["pk1", "pk2", ...]
                privateTags = parsed
                  .filter(p => typeof p === "string" && isHexPubkey(normPubkey(p)))
                  .map(p => ["p", normPubkey(p)]);
              }
            }
          } catch { decryptFailed = true; }
        } else {
          decryptFailed = true;
        }
      } else if (content) {
        decryptFailed = true;
      }

      if (!cancelled && generation === gen) {
        if (decryptFailed) {
          // Signer may still be warming up (common on mobile, where nip44
          // injection is often slower than the wait above) — don't
          // permanently flag the list as unreadable (which blocks
          // mute/unmute) on the first failure. Self-heal with a couple of
          // delayed background retries first, same as useBookmarks.js.
          settledRef.current = true;
          if (bgRetryCount < 2) {
            bgRetryCount++;
            setTimeout(() => { if (!cancelled) process(); }, 5000);
            return;
          }
          unreadableRef.current = true;
          setMuteEvent(ev);
          return;
        }

        unreadableRef.current = false;
        const pub = parseMuteTags(ev.tags || []);
        const priv = parseMuteTags(privateTags);
        const result = {
          pubkeys: mergeUniq(priv.pubkeys, pub.pubkeys),
          hashtags: mergeUniq(priv.hashtags, pub.hashtags),
          words: mergeUniq(priv.words, pub.words),
          threads: mergeUniq(priv.threads, pub.threads),
        };
        setMutes(result.pubkeys); mutesRef.current = result.pubkeys;
        setHashtags(result.hashtags); hashtagsRef.current = result.hashtags;
        setWords(result.words); wordsRef.current = result.words;
        setThreads(result.threads); threadsRef.current = result.threads;
        writeCache(pk, result, ev.created_at);
        knownCreatedAt = ev.created_at;
        setMuteEvent(ev);
        settledRef.current = true;
      }
    };

    const sub = pool.group(relayUrls$, false).subscription([{ kinds: [MUTE_LIST_KIND], authors: [pk] }]).subscribe({
      next: raw => {
        if (raw.kind !== MUTE_LIST_KIND) return;
        eventStore.add(raw);
        if (!cancelled && raw.created_at > Math.max(knownCreatedAt, latestEvent?.created_at ?? 0)) {
          latestEvent = raw;
          clearTimeout(processTimer);
          processTimer = setTimeout(process, 300);
        }
      },
      error: () => {
        // Only show empty on a subscription error if we never got a real
        // answer at all — a relay disconnecting *after* successfully
        // delivering the list (normal for a long-lived subscription) must
        // not clobber data that's already loaded and showing.
        if (!cancelled && !cached && !settledRef.current) { setMutes([]); setHashtags([]); setWords([]); setThreads([]); }
      },
    });

    const cutoffTimer = setTimeout(() => {
      sub.unsubscribe();
      settledRef.current = true;
      // Only reprocess if the current latestEvent hasn't already been
      // successfully applied — otherwise this redundantly re-decrypts and
      // re-emits new (but content-identical) state arrays for no reason.
      if (!latestEvent || latestEvent.created_at !== knownCreatedAt) process();
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(processTimer);
      clearTimeout(cutoffTimer);
      sub.unsubscribe();
    };
  }, [pubkey]);

  const persistAll = useCallback(
    async (pks, hts, wds, ths) => {
      const pk = normPubkey(pubkey);
      if (!signAndPublish || !isHexPubkey(pk)) throw new Error("Sign in to update mute list");
      if (!hasNip44()) throw new Error("Your wallet does not support NIP-44 (update the extension)");
      if (!settledRef.current) throw new Error("Mute list is still syncing from relays, please try again in a moment");
      if (unreadableRef.current) throw new Error("Existing mute list was created by a different signer and cannot be safely modified");
      const allTags = [
        ...pks.map(p => ["p", p]),
        ...hts.map(t => ["t", t]),
        ...wds.map(w => ["word", w]),
        ...ths.map(e => ["e", e]),
      ];
      const ciphertext = await window.nostr.nip44.encrypt(pk, JSON.stringify(allTags));
      await signAndPublish({ kind: MUTE_LIST_KIND, content: ciphertext, tags: [] });
    },
    [signAndPublish, pubkey]
  );

  const mute = useCallback(async targetPk => {
    const norm = normPubkey(targetPk);
    if (!isHexPubkey(norm)) return;
    const prev = mutesRef.current;
    if (prev.includes(norm)) return;
    const next = [...prev, norm];
    mutesRef.current = next; setMutes(next);
    try { await persistAll(next, hashtagsRef.current, wordsRef.current, threadsRef.current); }
    catch (e) { mutesRef.current = prev; setMutes(prev); throw e; }
  }, [persistAll]);

  const unmute = useCallback(async targetPk => {
    const norm = normPubkey(targetPk);
    if (!isHexPubkey(norm)) return;
    const prev = mutesRef.current;
    const next = prev.filter(p => p !== norm);
    if (next.length === prev.length) return;
    mutesRef.current = next; setMutes(next);
    try { await persistAll(next, hashtagsRef.current, wordsRef.current, threadsRef.current); }
    catch (e) { mutesRef.current = prev; setMutes(prev); throw e; }
  }, [persistAll]);

  const unmuteHashtag = useCallback(async hashtag => {
    const norm = hashtag.toLowerCase().replace(/^#/, "");
    const prev = hashtagsRef.current;
    const next = prev.filter(h => h !== norm);
    if (next.length === prev.length) return;
    hashtagsRef.current = next; setHashtags(next);
    try { await persistAll(mutesRef.current, next, wordsRef.current, threadsRef.current); }
    catch (e) { hashtagsRef.current = prev; setHashtags(prev); throw e; }
  }, [persistAll]);

  const unmuteWord = useCallback(async word => {
    const norm = word.toLowerCase().trim();
    const prev = wordsRef.current;
    const next = prev.filter(w => w !== norm);
    if (next.length === prev.length) return;
    wordsRef.current = next; setWords(next);
    try { await persistAll(mutesRef.current, hashtagsRef.current, next, threadsRef.current); }
    catch (e) { wordsRef.current = prev; setWords(prev); throw e; }
  }, [persistAll]);

  const unmuteThread = useCallback(async eventId => {
    const prev = threadsRef.current;
    const next = prev.filter(t => t !== eventId);
    if (next.length === prev.length) return;
    threadsRef.current = next; setThreads(next);
    try { await persistAll(mutesRef.current, hashtagsRef.current, wordsRef.current, next); }
    catch (e) { threadsRef.current = prev; setThreads(prev); throw e; }
  }, [persistAll]);

  const isMuted = useCallback(
    targetPk => {
      if (!targetPk) return false;
      return mutesRef.current.includes(normPubkey(targetPk));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutes]
  );

  const isContentMuted = useCallback(
    event => {
      if (!event) return null;
      if (hashtagsRef.current.length > 0) {
        for (const t of event.tags || []) {
          if (t[0] === "t" && t[1] && hashtagsRef.current.includes(t[1].toLowerCase().replace(/^#/, "")))
            return `#${t[1].toLowerCase().replace(/^#/, "")}`;
        }
      }
      if (wordsRef.current.length > 0 && event.content) {
        const lower = event.content.toLowerCase();
        for (const word of wordsRef.current) {
          if (lower.includes(word)) return word;
        }
      }
      // Checked last so hashtag/word reasons win — callers that skip the
      // thread reason (e.g. ThreadView) still gate on the more specific ones
      if (threadsRef.current.length > 0) {
        if (threadsRef.current.includes(event.id)) return "thread";
        for (const t of event.tags || []) {
          if (t[0] === "e" && t[1] && t[3] !== "mention" && threadsRef.current.includes(t[1])) return "thread";
        }
      }
      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hashtags, words, threads]
  );

  const toggleMute = useCallback(
    async targetPk => {
      const norm = normPubkey(targetPk);
      if (mutesRef.current.includes(norm)) return unmute(targetPk);
      return mute(targetPk);
    },
    [mute, unmute]
  );

  const muteHashtag = useCallback(async tag => {
    const norm = tag.toLowerCase().replace(/^#/, "");
    if (!norm) return;
    const prev = hashtagsRef.current;
    if (prev.includes(norm)) return;
    const next = [...prev, norm];
    hashtagsRef.current = next; setHashtags(next);
    try { await persistAll(mutesRef.current, next, wordsRef.current, threadsRef.current); }
    catch (e) { hashtagsRef.current = prev; setHashtags(prev); throw e; }
  }, [persistAll]);

  const muteThread = useCallback(async eventId => {
    const norm = (eventId || "").toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(norm)) throw new Error("Invalid thread id");
    const prev = threadsRef.current;
    if (prev.includes(norm)) return;
    const next = [...prev, norm];
    threadsRef.current = next; setThreads(next);
    try { await persistAll(mutesRef.current, hashtagsRef.current, wordsRef.current, next); }
    catch (e) { threadsRef.current = prev; setThreads(prev); throw e; }
  }, [persistAll]);

  const muteWord = useCallback(async word => {
    const norm = word.toLowerCase().trim();
    if (!norm) return;
    const prev = wordsRef.current;
    if (prev.includes(norm)) return;
    const next = [...prev, norm];
    wordsRef.current = next; setWords(next);
    try { await persistAll(mutesRef.current, hashtagsRef.current, next, threadsRef.current); }
    catch (e) { wordsRef.current = prev; setWords(prev); throw e; }
  }, [persistAll]);

  return {
    mutes, hashtags, words, threads,
    muteEvent, mute, unmute, muteHashtag, muteWord, muteThread, unmuteHashtag, unmuteWord, unmuteThread,
    isMuted, isContentMuted, toggleMute,
  };
}
