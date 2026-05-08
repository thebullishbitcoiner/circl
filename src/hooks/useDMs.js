import { useState, useEffect, useCallback, useRef } from "react";
import { ActionRunner } from "applesauce-actions";
import { SendWrappedMessage } from "applesauce-actions/actions";
import { ExtensionSigner } from "applesauce-signers";
import { unlockGiftWrap, isGiftWrapUnlocked } from "applesauce-common/helpers/gift-wrap";
import { mapEventsToStore } from "applesauce-core/observable/map-events-to-store";
import { tap } from "rxjs";
import { kinds } from "nostr-tools";
import { eventStore, pool } from "../nostr.js";
import { RELAYS } from "../constants.js";

let _signer = null;
function getSigner() {
  if (!_signer) _signer = new ExtensionSigner();
  return _signer;
}

export default function useDMs({ pubkey }) {
  const [dmRelays, setDmRelays] = useState(RELAYS);
  const [unlocking, setUnlocking] = useState(false);
  const actionsRef = useRef(null);

  // Build ActionRunner when pubkey is available
  useEffect(() => {
    if (!pubkey) return;
    const signer = getSigner();
    actionsRef.current = new ActionRunner(
      eventStore,
      signer,
      async (event, relays) => {
        await pool.publish(relays || dmRelays, event);
        // Add gift wraps addressed to self into the local store and unlock immediately
        // so sent messages appear without waiting for the relay to echo them back
        if (event.kind === kinds.GiftWrap && event.tags.some(t => t[0] === "p" && t[1] === pubkey)) {
          const stored = eventStore.add(event);
          unlockGiftWrap(stored, signer).catch(() => {});
        }
      }
    );
  }, [pubkey, dmRelays]);

  // Fetch user's DM relay list (kind 10050) and update dmRelays
  useEffect(() => {
    if (!pubkey) return;
    const sub = pool.subscription(RELAYS, {
      kinds: [kinds.DirectMessageRelaysList],
      authors: [pubkey],
      limit: 1,
    }).pipe(mapEventsToStore(eventStore)).subscribe(ev => {
      const relays = ev.tags.filter(t => t[0] === "relay").map(t => t[1]).filter(Boolean);
      if (relays.length) setDmRelays(relays);
    });
    return () => sub.unsubscribe();
  }, [pubkey]);

  // Subscribe to incoming gift wraps and unlock each one as it arrives.
  // Always query both the user's DM relays AND the default RELAYS so that
  // messages sent by other clients to any relay are picked up.
  useEffect(() => {
    if (!pubkey) return;
    const signer = getSigner();
    const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 365;
    const relays = [...new Set([...RELAYS, ...dmRelays])];
    const sub = pool.subscription(relays, {
      kinds: [kinds.GiftWrap],
      "#p": [pubkey],
      since,
    }).pipe(
      mapEventsToStore(eventStore),
      tap(ev => {
        if (!isGiftWrapUnlocked(ev)) {
          unlockGiftWrap(ev, signer).catch(() => {});
        }
      })
    ).subscribe();
    return () => sub.unsubscribe();
  }, [pubkey, dmRelays]);

  const unlock = useCallback(async () => {
    if (!pubkey || unlocking) return;
    const signer = getSigner();
    setUnlocking(true);
    try {
      const locked = eventStore
        .getTimeline({ kinds: [kinds.GiftWrap] })
        .filter(e => !isGiftWrapUnlocked(e));
      await Promise.allSettled(locked.map(gift => unlockGiftWrap(gift, signer)));
    } finally {
      setUnlocking(false);
    }
  }, [pubkey, unlocking]);

  const sendMessage = useCallback(async (participants, message) => {
    if (!actionsRef.current) throw new Error("Not ready");
    await actionsRef.current.run(SendWrappedMessage, participants, message);
  }, []);

  return { dmRelays, unlock, unlocking, sendMessage };
}
