import { useState, useEffect, useCallback, useRef } from "react";
import { ActionRunner } from "applesauce-actions";
import { SendWrappedMessage } from "applesauce-actions/actions";
import { ExtensionSigner } from "applesauce-signers";
import { unlockGiftWrap, isGiftWrapUnlocked } from "applesauce-common/helpers/gift-wrap";
import { mapEventsToStore } from "applesauce-core/observable/map-events-to-store";
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
  const failedRef = useRef(new Set(
    JSON.parse(localStorage.getItem("circl_failed_gift_wraps") || "[]")
  ));

  // Build ActionRunner when pubkey is available
  useEffect(() => {
    if (!pubkey) return;
    const signer = getSigner();
    actionsRef.current = new ActionRunner(
      eventStore,
      signer,
      async (event, relays) => {
        await pool.publish(relays || dmRelays, event);
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

  // Subscribe to incoming gift wraps
  useEffect(() => {
    if (!pubkey || !dmRelays.length) return;
    const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30;
    const sub = pool.subscription(dmRelays, {
      kinds: [kinds.GiftWrap],
      "#p": [pubkey],
      since,
    }).pipe(mapEventsToStore(eventStore)).subscribe();
    return () => sub.unsubscribe();
  }, [pubkey, dmRelays]);

  const unlock = useCallback(async () => {
    if (!pubkey || unlocking) return;
    const signer = getSigner();
    setUnlocking(true);
    try {
      const locked = eventStore
        .getTimeline({ kinds: [kinds.GiftWrap] })
        .filter(e => !isGiftWrapUnlocked(e) && !failedRef.current.has(e.id));
      for (const gift of locked) {
        try {
          await unlockGiftWrap(gift, signer);
        } catch {
          failedRef.current.add(gift.id);
          localStorage.setItem("circl_failed_gift_wraps", JSON.stringify([...failedRef.current]));
        }
      }
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
