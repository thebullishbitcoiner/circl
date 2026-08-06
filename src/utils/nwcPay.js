import { NWCClient } from "@getalby/sdk/nwc";
import { getActivePubkey } from "../nostr.js";
import { hasNip44 } from "../utils.js";

function readWalletRecord() {
  const pk = getActivePubkey();
  if (!pk) return null;
  try {
    const store = JSON.parse(localStorage.getItem("circl_wallet")) ?? {};
    return store[pk] ?? null;
  } catch { return null; }
}

/** Returns { ok: true } or { ok: false, reason, noWallet? } */
export async function payWithNWC(invoice) {
  const rec = readWalletRecord();
  if (!rec?.nwc_uri_enc) return { ok: false, noWallet: true, reason: "No wallet connected" };
  if (!hasNip44()) return { ok: false, reason: "Signer does not support NIP-44 decryption" };

  let nwc_uri;
  try {
    nwc_uri = await window.nostr.nip44.decrypt(getActivePubkey(), rec.nwc_uri_enc);
  } catch {
    return { ok: false, reason: "Could not unlock wallet connection" };
  }

  const client = new NWCClient({ nostrWalletConnectUrl: nwc_uri });
  try {
    await client.payInvoice({ invoice });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "Payment failed" };
  } finally {
    client.close();
  }
}

export function hasWallet() {
  return !!readWalletRecord()?.nwc_uri_enc;
}
