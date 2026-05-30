import { useState, useEffect, useRef } from "react";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

export default function useStreamChat(streamEvent) {
  const [messages, setMessages] = useState([]);
  const seen = useRef(new Set());

  useEffect(() => {
    if (!streamEvent) return;
    seen.current.clear();
    setMessages([]);

    const pubkey = streamEvent.pubkey;
    const d = streamEvent.tags?.find(t => t[0] === "d")?.[1] ?? "";
    const aTag = `30311:${pubkey}:${d}`;
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;

    const sub = pool.subscription(relayUrls, [{ kinds: [1311], "#a": [aTag], limit: 200 }]).subscribe({
      next: ev => {
        eventStore.add(ev);
        if (seen.current.has(ev.id)) return;
        seen.current.add(ev.id);
        setMessages(prev => [...prev, ev].sort((a, b) => a.created_at - b.created_at));
      },
    });

    return () => sub.unsubscribe();
  }, [streamEvent?.id]);

  return { messages };
}
