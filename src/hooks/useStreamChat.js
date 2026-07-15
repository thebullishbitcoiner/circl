import { useState, useEffect, useRef, useCallback } from "react";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";

export default function useStreamChat(streamEvent) {
  const [messages, setMessages] = useState([]);
  const seen = useRef(new Set());

  const addMessage = useCallback(ev => {
    if (seen.current.has(ev.id)) return;
    seen.current.add(ev.id);
    setMessages(prev => [...prev, ev].sort((a, b) => a.created_at - b.created_at));
  }, []);

  useEffect(() => {
    if (!streamEvent) return;
    seen.current.clear();
    setMessages([]);

    const pubkey = streamEvent.pubkey;
    const d = streamEvent.tags?.find(t => t[0] === "d")?.[1] ?? "";
    const aTag = `30311:${pubkey}:${d}`;

    // Include any relay hints from the stream event's relays tag
    const streamRelays = streamEvent.tags
      .filter(t => t[0] === "relays")
      .flatMap(t => t.slice(1))
      .filter(Boolean);
    const poolRelays = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
    const relayUrls = [...new Set([...poolRelays, ...streamRelays])];

    const sub = pool.subscription(relayUrls, [
      { kinds: [1311], "#a": [aTag], limit: 200 },
      { kinds: [9735], "#a": [aTag], limit: 100 },
    ]).subscribe({
      next: ev => {
        eventStore.add(ev);
        addMessage(ev);
      },
    });

    return () => sub.unsubscribe();
  }, [streamEvent?.id]);

  return { messages, addMessage };
}
