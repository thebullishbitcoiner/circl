import { NWCClient } from "@getalby/sdk/nwc";

/** Returns { ok: true } or { ok: false, reason, noWallet? } */
export async function payWithNWC(invoice) {
  let walletData;
  try {
    const raw = localStorage.getItem("circl_wallet");
    walletData = raw ? JSON.parse(raw) : null;
  } catch { walletData = null; }

  if (!walletData?.nwc_uri) return { ok: false, noWallet: true, reason: "No wallet connected" };

  const client = new NWCClient({ nostrWalletConnectUrl: walletData.nwc_uri });
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
  try {
    const raw = localStorage.getItem("circl_wallet");
    return !!(raw && JSON.parse(raw)?.nwc_uri);
  } catch { return false; }
}
