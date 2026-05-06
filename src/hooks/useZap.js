import { useCallback } from "react";

export default function useZap(wallet) {
  const sendZap = useCallback(async ({ amountSats, recipientLud16, eventId }) => {
    if (!wallet?.nwc_uri) return { ok: false, reason: "no_wallet" };
    console.log("[NWC] would zap", amountSats, "sats to", recipientLud16, "for event", eventId);
    return { ok: true };
  }, [wallet]);

  return { sendZap, connected: !!wallet?.nwc_uri };
}
