import { useState, useEffect, useCallback, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

const SERVER_LIST_KIND = 10063;
const LS_KEY = "circl_blossom_v1";

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveToStorage(servers) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(servers)); } catch {}
}

export default function useBlossomServers({ pubkey, signAndPublish } = {}) {
  const [servers, setServers] = useState(() => loadFromStorage());

  const serversRef  = useRef(servers);
  const hasMutated  = useRef(false);
  useEffect(() => { serversRef.current = servers; }, [servers]);

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk)) { return; }

    hasMutated.current = false;
    let cancelled = false;
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
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
          saveToStorage(parsed);
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
    saveToStorage(newList);
    try {
      await signAndPublish({
        kind: SERVER_LIST_KIND,
        content: "",
        tags: newList.map(url => ["server", url]),
      });
    } catch (e) {
      serversRef.current = prev;
      setServers(prev);
      saveToStorage(prev);
      throw e;
    }
  }, [signAndPublish, pubkey]);

  return { servers, saveServers };
}
