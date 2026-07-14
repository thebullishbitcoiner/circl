import { useState, useEffect, useCallback } from "react";
import { RELAYS, NOSTR_CLIENT_TAG } from "../constants.js";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool, validRelays } from "../nostr.js";
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
    for (const url of RELAYS) pool.relay(url);
    setPubkey(pk);
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
      for (const url of RELAYS) pool.relay(url);
      setPubkey(pk);
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
    const signed = await withTimeout(
      window.nostr.signEvent(unsigned),
      10000,
      "Extension did not sign in time."
    );
    // Explicit relay override (e.g. private relays for drafts) takes priority;
    // otherwise publish to own outboxes, union with bootstrap relays as fallback
    const publishRelays = opts.relays?.length > 0
      ? opts.relays
      : outboxes.length > 0
        ? [...new Set([...RELAYS, ...outboxes])]
        : RELAYS;
    // Fire-and-forget relay publish so callers get the signed event immediately
    Promise.race([
      pool.publish(publishRelays, signed),
      new Promise(resolve => setTimeout(resolve, 8000)),
    ]).catch(() => null);
    return signed;
  }, [pubkey, outboxes]);

  return { pubkey, status, error, login, logout, signAndPublish, privateRelayUrls };
}
