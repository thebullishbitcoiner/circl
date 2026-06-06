import { useState, useEffect } from "react";
import { getStreamStatus } from "applesauce-common/helpers/stream";
import { getOutboxes } from "applesauce-core/helpers/mailboxes";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";
import { isHexPubkey } from "../utils.js";

export default function useActiveStream(pubkey) {
  const [stream, setStream] = useState(null);

  useEffect(() => {
    if (!pubkey || !isHexPubkey(pubkey)) return;

    // Check eventStore immediately — free, synchronous
    const cached = eventStore.getTimeline([{ kinds: [30311], authors: [pubkey] }]);
    for (const ev of cached) {
      if (getStreamStatus(ev) === "live") {
        setStream(ev);
        break;
      }
    }

    const defaultRelays = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    const subs = [];
    let best = null;

    function consider(ev) {
      eventStore.add(ev);
      if (getStreamStatus(ev) === "live") {
        if (!best || ev.created_at > best.created_at) {
          best = ev;
          setStream(ev);
        }
      }
    }

    // Query default relays for both the stream event and the user's relay list together.
    // When we get a kind 10002, additionally query their outbox relays — that's where
    // stream events are actually published (e.g. relay.zap.stream, nostrnests.com).
    const sub1 = pool.request(defaultRelays, [
      { kinds: [30311], authors: [pubkey], limit: 5 },
      { kinds: [10002], authors: [pubkey], limit: 1 },
    ]).subscribe({
      next: ev => {
        if (ev.kind === 10002) {
          eventStore.add(ev);
          const outboxes = getOutboxes(ev);
          const newRelays = outboxes.filter(r => !defaultRelays.includes(r));
          if (newRelays.length > 0) {
            const sub2 = pool.request(newRelays, [{ kinds: [30311], authors: [pubkey], limit: 5 }]).subscribe({
              next: consider,
            });
            subs.push(sub2);
          }
        } else if (ev.kind === 30311) {
          consider(ev);
        }
      },
    });
    subs.push(sub1);

    return () => subs.forEach(s => s.unsubscribe());
  }, [pubkey]);

  return { stream };
}
