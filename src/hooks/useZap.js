import { useCallback } from "react";
import { NWCClient } from "@getalby/sdk/nwc";
import { LightningAddress } from "@getalby/lightning-tools/lnurl";
import { RELAYS } from "../constants.js";

export default function useZap(wallet) {
  const sendZap = useCallback(async ({ amountSats, recipientLud16, recipientPubkey, eventId }) => {
    console.warn("[zap] sendZap called", { amountSats, recipientLud16, recipientPubkey, eventId });
    console.log("[zap] wallet present:", !!wallet?.nwc_uri);

    if (!wallet?.nwc_uri) return { ok: false, reason: "no_wallet" };
    if (!recipientLud16) return { ok: false, reason: "no_lud16" };

    let client;
    try {
      console.log("[zap] fetching LNURL data for", recipientLud16);
      const ln = new LightningAddress(recipientLud16);
      await ln.fetch();
      console.log("[zap] lnurlpData:", ln.lnurlpData);
      console.log("[zap] allowsNostr:", ln.lnurlpData?.allowsNostr, "window.nostr:", !!window.nostr);

      let invoice;
      const canZap = ln.lnurlpData?.allowsNostr && window.nostr;
      if (canZap) {
        console.log("[zap] using zapInvoice (NIP-57)");
        invoice = await ln.zapInvoice(
          { satoshi: amountSats, comment: "", relays: RELAYS, p: recipientPubkey, e: eventId },
          { nostr: window.nostr }
        );
      } else {
        console.log("[zap] using requestInvoice (plain LNURL-pay)");
        invoice = await ln.requestInvoice({ satoshi: amountSats });
      }
      console.log("[zap] got invoice:", invoice?.paymentRequest?.slice(0, 40) + "…");

      console.log("[zap] connecting NWC client");
      client = new NWCClient({ nostrWalletConnectUrl: wallet.nwc_uri });
      console.log("[zap] paying invoice via NWC");
      const response = await client.payInvoice({ invoice: invoice.paymentRequest });
      console.log("[zap] payment response:", response);
      return { ok: true };
    } catch (e) {
      console.error("[zap] error:", e);
      return { ok: false, reason: e.message || "payment_failed" };
    } finally {
      client?.close();
    }
  }, [wallet]);

  return { sendZap, connected: !!wallet?.nwc_uri };
}
