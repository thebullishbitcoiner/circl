import { useCallback } from "react";
import { NWCClient } from "@getalby/sdk/nwc";
import { makeZapRequest } from "nostr-tools/nip57";
import { bech32 } from "@scure/base";
import { decodeInvoice } from "@getalby/lightning-tools";
import { RELAYS } from "../constants.js";
import { cacheZapReq } from "../utils.js";

const utf8Decoder = new TextDecoder();

// Fetch LNURL pay endpoint data directly — no proxy
async function fetchLnurlData(lnAddr) {
  let url;
  if (lnAddr.includes("@")) {
    // lud16: user@domain.com
    const [name, domain] = lnAddr.split("@");
    url = `https://${domain}/.well-known/lnurlp/${name}`;
  } else {
    // lud06: bech32-encoded LNURL
    const { words } = bech32.decode(lnAddr, 1000);
    url = utf8Decoder.decode(bech32.fromWords(words));
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`LNURL fetch failed: ${res.status}`);
  const body = await res.json();
  if (body.status === "ERROR") throw new Error(body.reason || "LNURL error");
  return body;
}

export default function useZap(wallet) {
  const sendZap = useCallback(async ({ amountSats, recipientLnAddr, recipientPubkey, eventId, eventKind = 1, aTag = null, extraRelays = [], msg = "", pollOption = null }) => {
    if (!wallet?.nwc_uri) return { ok: false, reason: "no_wallet" };
    if (!recipientLnAddr) return { ok: false, reason: "no_lud16" };

    let client;
    try {
      const msats = amountSats * 1000;
      const allRelays = [...new Set([...RELAYS, ...extraRelays])];

      // Fetch LNURL data directly (bypasses any proxy that might strip allowsNostr)
      const lnurlData = await fetchLnurlData(recipientLnAddr);
      const { callback, allowsNostr, commentAllowed } = lnurlData;
      if (!callback) throw new Error("No LNURL callback");
      let pr;

      // Try NIP-57 zap request if the endpoint supports Nostr, we have a signer, and a
      // recipient pubkey to put in the zap request's "p" tag (required by NIP-57).
      // Use `!== false` like Jumble — treats missing allowsNostr as supported.
      let signed = null;
      if (allowsNostr !== false && window.nostr && recipientPubkey) {
        try {
          let zapRequestTemplate;
          if (aTag) {
            // Addressable event (e.g. kind 30311): use "a" tag, not "e" tag
            zapRequestTemplate = makeZapRequest({ pubkey: recipientPubkey, amount: msats, comment: msg, relays: allRelays });
            zapRequestTemplate.tags.push(["a", aTag]);
          } else if (eventId) {
            zapRequestTemplate = makeZapRequest({ event: { id: eventId, pubkey: recipientPubkey, kind: eventKind, tags: [], content: "", created_at: 0, sig: "" }, amount: msats, comment: msg, relays: allRelays });
          } else {
            zapRequestTemplate = makeZapRequest({ pubkey: recipientPubkey, amount: msats, comment: msg, relays: allRelays });
          }

          if (pollOption) zapRequestTemplate.tags.push(["poll_option", pollOption]);
          signed = await window.nostr.signEvent(zapRequestTemplate);

          const callbackUrl = new URL(callback);
          callbackUrl.searchParams.set("amount", String(msats));
          callbackUrl.searchParams.set("nostr", JSON.stringify(signed));

          const invoiceRes = await fetch(callbackUrl.toString(), { signal: AbortSignal.timeout(10000) });
          const invoiceData = await invoiceRes.json();
          if (invoiceData.status === "ERROR") throw new Error(invoiceData.reason || "Invoice error");
          if (!invoiceData.pr) throw new Error("No invoice in response");
          pr = invoiceData.pr;
        } catch {
          signed = null;
        }
      }

      if (!pr) {
        const callbackUrl = new URL(callback);
        callbackUrl.searchParams.set("amount", String(msats));
        if (msg && commentAllowed && msg.length <= commentAllowed) {
          callbackUrl.searchParams.set("comment", msg);
        }
        const invoiceRes = await fetch(callbackUrl.toString(), { signal: AbortSignal.timeout(10000) });
        const invoiceData = await invoiceRes.json();
        if (!invoiceData.pr) throw new Error(invoiceData.reason || "No invoice from LNURL-pay");
        pr = invoiceData.pr;
      }

      client = new NWCClient({ nostrWalletConnectUrl: wallet.nwc_uri });
      const result = await client.payInvoice({ invoice: pr });

      // Derive payment hash from preimage (guaranteed correct); fall back to invoice decode
      let paymentHash = null;
      if (result?.preimage) {
        try {
          const bytes = new Uint8Array(result.preimage.match(/.{2}/g).map(b => parseInt(b, 16)));
          const buf = await crypto.subtle.digest("SHA-256", bytes);
          paymentHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
        } catch {}
      }
      if (!paymentHash) {
        try { paymentHash = decodeInvoice(pr)?.paymentHash ?? null; } catch {}
      }
      if (paymentHash) {
        cacheZapReq(paymentHash, signed ?? { pubkey: null, tags: [["p", recipientPubkey]], content: msg ?? "" });
      }

      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e.message || "payment_failed" };
    } finally {
      client?.close();
    }
  }, [wallet]);

  return { sendZap, connected: !!wallet?.nwc_uri };
}
