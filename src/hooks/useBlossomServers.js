import { useState, useEffect, useCallback, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";

const SERVER_LIST_KIND = 10063;
const LS_KEY = "circl_blossom_v1";

function readRawStore() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; }
}

// Namespaced by pubkey so switching accounts never surfaces another account's server list.
function loadFromStorage(pubkey) {
  const raw = readRawStore();
  if (Array.isArray(raw)) {
    // Pre-namespacing install: a single flat server list. Claim it for
    // whichever account loads first rather than losing it — the old shape
    // also made subsequent saves silently fail (JSON.stringify drops
    // non-index properties set directly on an array), so this doubles as
    // the fix for that.
    try { localStorage.setItem(LS_KEY, JSON.stringify({ [pubkey]: raw })); } catch {}
    return raw;
  }
  const parsed = raw && typeof raw === "object" ? raw[pubkey] : undefined;
  return Array.isArray(parsed) ? parsed : [];
}

function saveToStorage(pubkey, servers) {
  try {
    const raw = readRawStore();
    const store = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    store[pubkey] = servers;
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {}
}

export default function useBlossomServers({ pubkey, signAndPublish } = {}) {
  const [servers, setServers] = useState(() => loadFromStorage(pubkey));

  const serversRef  = useRef(servers);
  const hasMutated  = useRef(false);
  useEffect(() => { serversRef.current = servers; }, [servers]);

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) {
      serversRef.current = [];
      setServers([]);
      return;
    }

    serversRef.current = loadFromStorage(pk);
    setServers(serversRef.current);
    hasMutated.current = false;
    let cancelled = false;
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
    const received  = [];

    const sub = pool.request(relayUrls, [{ kinds: [SERVER_LIST_KIND], authors: [pk] }]).subscribe({
      next: raw => { eventStore.add(raw); received.push(raw); },
      complete: () => {
        if (cancelled || hasMutated.current) return;

        let latest = null;
        for (const ev of received) {
          if (!latest || ev.created_at > latest.created_at) latest = ev;
        }
        if (!latest) return;

        const parsed = (latest.tags || [])
          .filter(t => t[0] === "server" && t[1])
          .map(t => t[1]);

        if (!cancelled) {
          serversRef.current = parsed;
          setServers(parsed);
          saveToStorage(pk, parsed);
        }
      },
      error: () => {},
    });

    return () => { cancelled = true; sub.unsubscribe(); };
  }, [pubkey]);

  const saveServers = useCallback(async (newList) => {
    const pk = normPubkey(pubkey);
    if (!signAndPublish || !isHexPubkey(pk)) throw new Error("Sign in to manage Blossom servers");
    hasMutated.current = true;
    const prev = serversRef.current;
    serversRef.current = newList;
    setServers(newList);
    saveToStorage(pk, newList);
    try {
      await signAndPublish({
        kind: SERVER_LIST_KIND,
        content: "",
        tags: newList.map(url => ["server", url]),
      });
    } catch (e) {
      serversRef.current = prev;
      setServers(prev);
      saveToStorage(pk, prev);
      throw e;
    }
  }, [signAndPublish, pubkey]);

  return { servers, saveServers };
}
