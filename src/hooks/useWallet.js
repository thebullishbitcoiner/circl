import { useState, useEffect, useCallback } from "react";
import { hasNip44 } from "../utils.js";

const STORAGE_KEY = "circl_wallet";

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}; } catch { return {}; }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// Pre-namespacing installs stored a single flat, plaintext
// { nwc_uri, lightning_address, source } object directly under this key —
// recognizable by the top-level nwc_uri string, which the new per-pubkey
// map shape never has (its top-level keys are pubkeys, not "nwc_uri").
function readLegacyFlat(store) {
  return typeof store.nwc_uri === "string" ? store : null;
}

// Wallet data is namespaced per pubkey so switching accounts never exposes one
// account's NWC connection to another. The nwc_uri itself carries the NIP-47
// spend secret, so it's NIP-44 self-encrypted (encrypted to the owner's own
// pubkey, same convention as private list content elsewhere in the app)
// before it touches localStorage — the other fields are non-sensitive.
export default function useWallet(pubkey) {
  const [wallet, setWallet] = useState(null);
  // true when a connection is saved for this pubkey but the current signer
  // can't decrypt it (missing/broken NIP-44 support) — distinct from "never connected"
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setWallet(null);
    setLocked(false);
    if (!pubkey) return;

    const store = readStore();

    // One-time migration: claim any pre-namespacing plaintext wallet for
    // whichever account is first to load after upgrading, rather than just
    // discarding it. Leaves it in place (retried on next load) if this
    // signer can't encrypt yet — never deletes it without a successful
    // migration to fall back on.
    const legacy = !store[pubkey] ? readLegacyFlat(store) : null;
    if (legacy) {
      if (!hasNip44()) return;
      window.nostr.nip44.encrypt(pubkey, legacy.nwc_uri)
        .then(nwc_uri_enc => {
          if (cancelled) return;
          delete store.nwc_uri;
          delete store.lightning_address;
          delete store.source;
          const data = { nwc_uri: legacy.nwc_uri, lightning_address: legacy.lightning_address ?? null, source: legacy.source ?? null };
          store[pubkey] = { nwc_uri_enc, lightning_address: data.lightning_address, source: data.source };
          writeStore(store);
          setWallet(data);
        })
        .catch(() => {});
      return;
    }

    const rec = store[pubkey];
    if (!rec?.nwc_uri_enc) return;
    if (!hasNip44()) { setLocked(true); return; }

    window.nostr.nip44.decrypt(pubkey, rec.nwc_uri_enc)
      .then(nwc_uri => {
        if (cancelled) return;
        setWallet({ nwc_uri, lightning_address: rec.lightning_address ?? null, source: rec.source ?? null });
      })
      .catch(() => { if (!cancelled) setLocked(true); });

    return () => { cancelled = true; };
  }, [pubkey]);

  const saveWallet = useCallback(async data => {
    if (!pubkey) throw new Error("Sign in to connect a wallet");
    if (!hasNip44()) throw new Error("Your signer doesn't support NIP-44 encryption — update your extension to connect a wallet");
    const nwc_uri_enc = await window.nostr.nip44.encrypt(pubkey, data.nwc_uri);
    const store = readStore();
    store[pubkey] = { nwc_uri_enc, lightning_address: data.lightning_address ?? null, source: data.source ?? null };
    writeStore(store);
    setWallet(data);
    setLocked(false);
  }, [pubkey]);

  const disconnect = useCallback(() => {
    if (!pubkey) return;
    const store = readStore();
    delete store[pubkey];
    writeStore(store);
    setWallet(null);
    setLocked(false);
  }, [pubkey]);

  return { wallet, locked, saveWallet, disconnect };
}
