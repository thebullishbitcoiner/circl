import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_RELAYS, NOSTR_CLIENT_TAG } from "../constants.js";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, validRelays, publishWithStatus, eventStore, setActivePubkey } from "../nostr.js";
import { isReplaceable, getReplaceableIdentifier } from "applesauce-core/helpers/event";
import useMailboxes from "./useMailboxes.js";
import useBlockedRelays from "./useBlockedRelays.js";
import usePrivateRelays from "./usePrivateRelays.js";

function withTimeout(promise, ms, message) {
  let timer;
  const race = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, race]).finally(() => clearTimeout(timer));
}

export default function useAuth() {
  const [pubkey, setPubkey] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  // Restore session
  useEffect(() => {
    const saved = sessionStorage.getItem("circl_pk");
    if (!saved) return;
    const pk = normPubkey(saved);
    if (!isHexPubkey(pk)) return;
    for (const url of DEFAULT_RELAYS) pool.relay(url);
    setPubkey(pk);
    setActivePubkey(pk);
    setStatus("ready");
  }, []);

  const login = useCallback(async () => {
    setStatus("checking");
    setError(null);
    try {
      if (!window.nostr) throw new Error("No Nostr extension found. Install Alby or nos2x.");
      const raw = await withTimeout(
        window.nostr.getPublicKey(),
        10000,
        "Extension did not respond in time. Reopen your Nostr wallet/extension and try again."
      );
      const pk = normPubkey(raw);
      if (!isHexPubkey(pk)) throw new Error("Extension returned an invalid pubkey.");
      for (const url of DEFAULT_RELAYS) pool.relay(url);
      setPubkey(pk);
      setActivePubkey(pk);
      setStatus("ready");
      sessionStorage.setItem("circl_pk", pk);
    } catch (e) {
      setError(e?.message || "Failed to connect.");
      setStatus("idle");
    }
  }, []);

  const logout = useCallback(() => {
    for (const url of [...pool.relays.keys()]) {
      try { pool.remove(url); } catch {}
    }
    setPubkey(null);
    setActivePubkey(null);
    setStatus("idle");
    sessionStorage.removeItem("circl_pk");
  }, []);

  // Keep the pool's blocked-relay set in sync (NIP-51 kind 10006)
  useBlockedRelays(pubkey);

  // Connect to own outbox relays once kind 10002 is fetched
  const { outboxes } = useMailboxes(pubkey);
  useEffect(() => {
    if (!pubkey || !outboxes.length) return;
    for (const url of validRelays(outboxes)) pool.relay(url);
  }, [pubkey, outboxes]);

  // Connect to own private relays once kind 10013 is fetched (used for drafts)
  const privateRelays = usePrivateRelays(pubkey);
  const privateRelayUrls = privateRelays.map(r => r.url);
  useEffect(() => {
    if (!pubkey || !privateRelayUrls.length) return;
    for (const url of validRelays(privateRelayUrls)) pool.relay(url);
  }, [pubkey, privateRelayUrls.join(",")]);

  // Track the set of relays the user explicitly configured so the challenge$
  // callback always reads the latest value without stale closure issues.
  const knownRelayUrlsRef = useRef(new Set(DEFAULT_RELAYS));
  useEffect(() => {
    knownRelayUrlsRef.current = new Set([...DEFAULT_RELAYS, ...outboxes, ...privateRelayUrls]);
  }, [outboxes, privateRelayUrls]);

  // Auto-respond to NIP-42 AUTH challenges reactively — only when a REQ or
  // EVENT is actually blocked, not on every connect/reconnect. The authenticating
  // Set is checked synchronously before calling signEvent so that a flood of
  // simultaneous auth-required responses (one per open subscription) collapses
  // into a single prompt.
  useEffect(() => {
    if (!pubkey) return;
    const authSubs = new Map();
    const authenticating = new Set();

    function tryAuthenticate(relay, url) {
      if (!window.nostr || !relay.challenge) return;
      if (relay.authenticated || authenticating.has(url)) return;
      const isKnown = knownRelayUrlsRef.current.has(url);
      if (!isKnown) {
        try {
          const s = JSON.parse(localStorage.getItem("circl_content_settings") || "{}");
          if (!s.relayAuth) return;
        } catch { return; }
      }
      authenticating.add(url);
      relay.authenticate({ signEvent: e => window.nostr.signEvent(e) })
        .finally(() => authenticating.delete(url))
        .catch(() => {});
    }

    const poolSub = pool.relays$.subscribe(relayMap => {
      for (const [url, relay] of relayMap) {
        if (authSubs.has(url)) continue;
        const readSub  = relay.authRequiredForRead$.subscribe(r  => { if (r) tryAuthenticate(relay, url); });
        const writeSub = relay.authRequiredForPublish$.subscribe(r => { if (r) tryAuthenticate(relay, url); });
        authSubs.set(url, { unsubscribe: () => { readSub.unsubscribe(); writeSub.unsubscribe(); } });
      }
    });
    return () => {
      poolSub.unsubscribe();
      for (const s of authSubs.values()) s.unsubscribe();
    };
  }, [pubkey]);

  const signAndPublish = useCallback(async (tmpl, opts = {}) => {
    if (!pubkey || !window.nostr) throw new Error("Not connected");
    const { tags: incomingTags, ...rest } = tmpl;
    const tags = [...(incomingTags || []).filter(t => t?.[0] !== "client"), NOSTR_CLIENT_TAG];
    const unsigned = {
      ...rest,
      tags,
      created_at: Math.floor(Date.now() / 1000),
      pubkey,
    };
    // EventStore rejects a replaceable event whose created_at doesn't strictly exceed
    // the version it already has (1s resolution collides easily on quick successive
    // saves), so bump past whatever's cached locally before signing.
    if (isReplaceable(unsigned.kind)) {
      const identifier = getReplaceableIdentifier(unsigned);
      const existing = eventStore.getReplaceable(unsigned.kind, pubkey, identifier);
      if (existing && existing.created_at >= unsigned.created_at) {
        unsigned.created_at = existing.created_at + 1;
      }
    }
    const signed = await withTimeout(
      window.nostr.signEvent(unsigned),
      10000,
      "Extension did not sign in time."
    );
    // Add to the local store immediately so reactive readers (e.g. useProfiles)
    // reflect the change right away instead of waiting on a relay round-trip.
    eventStore.add(signed);
    // Explicit relay override (e.g. private relays for drafts) takes priority;
    // otherwise publish to own outboxes, union with bootstrap relays as fallback
    const publishRelays = opts.relays?.length > 0
      ? opts.relays
      : outboxes.length > 0
        ? [...new Set([...DEFAULT_RELAYS, ...outboxes])]
        : DEFAULT_RELAYS;
    if (opts.trackStatus) {
      // Tracked publish: per-relay status flows into publishSession$ for the
      // publish-status card/modal. Still fire-and-forget from the caller's POV.
      publishWithStatus(publishRelays, signed);
    } else {
      // Fire-and-forget relay publish so callers get the signed event immediately
      Promise.race([
        pool.publish(publishRelays, signed),
        new Promise(resolve => setTimeout(resolve, 8000)),
      ]).catch(() => null);
    }
    return signed;
  }, [pubkey, outboxes]);

  return { pubkey, status, error, login, logout, signAndPublish, privateRelayUrls };
}
