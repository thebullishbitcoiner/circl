import { useState, useEffect } from "react";
import { isHexPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

// Track pubkeys we've already fetched so we don't re-request on remount
const _fetched = new Set();

export default function useMailboxes(pubkey) {
  const [mailboxes, setMailboxes] = useState({ inboxes: [], outboxes: [] });

  useEffect(() => {
    if (!pubkey || !isHexPubkey(pubkey)) {
      setMailboxes({ inboxes: [], outboxes: [] });
      return;
    }

    const sub = eventStore.mailboxes(pubkey).subscribe(m => {
      if (m) setMailboxes(m);
    });

    if (!_fetched.has(pubkey)) {
      _fetched.add(pubkey);
      const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
      pool.request(relayUrls, [{ kinds: [10002], authors: [pubkey], limit: 1 }]).subscribe({
        next: ev => eventStore.add(ev),
      });
    }

    return () => sub.unsubscribe();
  }, [pubkey]);

  return mailboxes;
}
