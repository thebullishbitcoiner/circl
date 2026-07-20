import { useState, useEffect } from "react";
import { isHexPubkey } from "../utils.js";
import { pool, eventStore, relayUrls$ } from "../nostr.js";

export default function useMailboxes(pubkey) {
  const [mailboxes, setMailboxes] = useState({ inboxes: [], outboxes: [] });

  useEffect(() => {
    if (!pubkey || !isHexPubkey(pubkey)) {
      setMailboxes({ inboxes: [], outboxes: [] });
      return;
    }

    let cancelled = false;
    const sub = eventStore.mailboxes(pubkey).subscribe(m => {
      if (m) setMailboxes(m);
    });

    // pool.group(relayUrls$, false) bypasses ignoreOffline and re-queries as
    // more relays connect, so a slow/losing race on the first attempt no
    // longer strands `outboxes` at [] for the rest of the session (which used
    // to also starve every other list hook of the wider relay set it needs).
    const reqSub = pool.group(relayUrls$, false).request([{ kinds: [10002], authors: [pubkey], limit: 1 }]).subscribe({
      next: ev => eventStore.add(ev),
      error: () => {},
    });
    const cutoffTimer = setTimeout(() => { if (!cancelled) reqSub.unsubscribe(); }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(cutoffTimer);
      reqSub.unsubscribe();
      sub.unsubscribe();
    };
  }, [pubkey]);

  return mailboxes;
}
