import { useState, useEffect, useCallback } from "react";
import { RELAYS, NOSTR_CLIENT_TAG } from "../constants.js";
import { isHexPubkey, normPubkey } from "../utils.js";
import { pool } from "../nostr.js";

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
    for (const url of RELAYS) {
      try { pool.remove(url); } catch {}
    }
    setPubkey(null);
    setStatus("idle");
    sessionStorage.removeItem("circl_pk");
  }, []);

  const signAndPublish = useCallback(async tmpl => {
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
    await Promise.race([
      pool.publish(RELAYS, signed),
      new Promise(resolve => setTimeout(resolve, 8000)),
    ]).catch(() => null);
    return signed;
  }, [pubkey]);

  return { pubkey, status, error, login, logout, signAndPublish };
}
