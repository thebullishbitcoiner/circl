import { useState, useEffect } from "react";
import { getStreamStatus } from "applesauce-common/helpers/stream";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";
import { isHexPubkey } from "../utils.js";

export default function useActiveStream(pubkey) {
  const [stream, setStream] = useState(null);

  useEffect(() => {
    if (!pubkey || !isHexPubkey(pubkey)) return;
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    let best = null;

    const sub = pool.request(relayUrls, [{ kinds: [30311], authors: [pubkey], limit: 5 }]).subscribe({
      next: ev => {
        eventStore.add(ev);
        if (getStreamStatus(ev) === "live") {
          if (!best || ev.created_at > best.created_at) {
            best = ev;
            setStream(ev);
          }
        }
      },
    });

    return () => sub.unsubscribe();
  }, [pubkey]);

  return { stream };
}
