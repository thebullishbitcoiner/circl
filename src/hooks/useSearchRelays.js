import { useState, useEffect } from "react";
import { Models } from "applesauce-common";
import { isHexPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

const _fetched = new Set();

export default function useSearchRelays(pubkey) {
  const [relays, setRelays] = useState([]);

  useEffect(() => {
    if (!pubkey || !isHexPubkey(pubkey)) {
      setRelays([]);
      return;
    }

    const sub = eventStore.model(Models.SearchRelaysModel, pubkey).subscribe(r => {
      if (r) setRelays(r);
    });

    if (!_fetched.has(pubkey)) {
      _fetched.add(pubkey);
      const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
      pool.request(relayUrls, [{ kinds: [10007], authors: [pubkey], limit: 1 }]).subscribe({
        next: ev => eventStore.add(ev),
      });
    }

    return () => sub.unsubscribe();
  }, [pubkey]);

  return relays;
}
