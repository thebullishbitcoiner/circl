import { useState, useEffect, useRef, useCallback } from "react";
import NDK, { NDKNip07Signer, NDKEvent } from "@nostr-dev-kit/ndk";
import { RELAYS, NOSTR_CLIENT_TAG } from "../constants.js";
import { isHexPubkey, normPubkey } from "../utils.js";

export default function useNDK() {
  const ndkRef = useRef(null);
  const [pubkey, setPubkey] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error,  setError]  = useState(null);

  // Restore session from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("circl_pk");
    if (!saved) return;
    const pk = normPubkey(saved);
    if (!isHexPubkey(pk)) return;
    setPubkey(pk);
    setStatus("ready");
    const signer   = new NDKNip07Signer();
    const instance = new NDK({ explicitRelayUrls: RELAYS, signer });
    instance.connect();
    ndkRef.current = instance;
  }, []);

  const login = useCallback(async () => {
    setStatus("checking");
    setError(null);
    try {
      if (!window.nostr) throw new Error("No Nostr extension found. Install Alby or nos2x.");
      const signer   = new NDKNip07Signer();
      const instance = new NDK({ explicitRelayUrls: RELAYS, signer });
      await instance.connect();
      const user = await signer.user();
      const pk   = normPubkey(user.pubkey);
      ndkRef.current = instance;
      setPubkey(pk);
      setStatus("ready");
      sessionStorage.setItem("circl_pk", pk);
    } catch (e) {
      setError(e.message);
      setStatus("idle");
    }
  }, []);

  const logout = useCallback(() => {
    ndkRef.current?.pool?.close?.();
    ndkRef.current = null;
    setPubkey(null);
    setStatus("idle");
    sessionStorage.removeItem("circl_pk");
  }, []);

  const signAndPublish = useCallback(async tmpl => {
    const ndk = ndkRef.current;
    if (!ndk?.signer) throw new Error("Not connected");
    const { tags: incomingTags, ...rest } = tmpl;
    const tags = [...(incomingTags || []).filter(t => t?.[0] !== "client"), NOSTR_CLIENT_TAG];
    const ev = new NDKEvent(ndk, {
      ...rest,
      tags,
      created_at: Math.floor(Date.now() / 1000),
      pubkey,
    });
    await ev.sign();
    await ev.publish();
    return ev.rawEvent();
  }, [pubkey]);

  return { ndk: ndkRef, pubkey, status, error, login, logout, signAndPublish };
}
