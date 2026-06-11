import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import { makeZapRequest } from "nostr-tools/nip57";
import { decodeInvoice } from "@getalby/lightning-tools";
import Overlay from "./Overlay.jsx";
import { haptic, cacheZapReq } from "../utils.js";
import { bech32 } from "@scure/base";
import { payWithNWC, hasWallet } from "../utils/nwcPay.js";
import { RELAYS } from "../constants.js";

const utf8Decoder = new TextDecoder();

async function fetchLnurlData(lnAddr) {
  let url;
  if (lnAddr.includes("@")) {
    const [name, domain] = lnAddr.split("@");
    url = `https://${domain}/.well-known/lnurlp/${name}`;
  } else {
    const { words } = bech32.decode(lnAddr, 1000);
    url = utf8Decoder.decode(bech32.fromWords(words));
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`LNURL fetch failed: ${res.status}`);
  const body = await res.json();
  if (body.status === "ERROR") throw new Error(body.reason || "LNURL error");
  return body;
}

async function fetchBtcPrice(currency) {
  const cur = currency.toUpperCase();
  try {
    const res = await fetch("https://mempool.space/api/v1/prices", { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data[cur]) return data[cur];
    }
  } catch {}
  try {
    const curLower = currency.toLowerCase();
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${curLower}`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.bitcoin?.[curLower]) return data.bitcoin[curLower];
    }
  } catch {}
  return null;
}

export default function ZapOutModal({ event, sellerLnAddr, onClose }) {
  const title = event.tags?.find(t => t[0] === "title")?.[1] || "Listing";
  const priceTag = event.tags?.find(t => t[0] === "price");
  const walletConnected = hasWallet();

  const [phase,   setPhase]   = useState("amount");
  const [amount,  setAmount]  = useState("");
  const [invoice, setInvoice] = useState("");
  const [error,   setError]   = useState("");
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    if (!priceTag) return;
    const [, amountStr, currency] = priceTag;
    const priceAmt = parseFloat(amountStr);
    if (!priceAmt || isNaN(priceAmt)) return;

    const cur = (currency || "").toLowerCase();
    if (cur === "sat" || cur === "sats") { setAmount(String(Math.round(priceAmt))); return; }
    if (cur === "msat" || cur === "msats") { setAmount(String(Math.round(priceAmt / 1000))); return; }
    if (cur === "btc") { setAmount(String(Math.round(priceAmt * 100_000_000))); return; }
    fetchBtcPrice(currency).then(btcPrice => {
      if (btcPrice) setAmount(String(Math.round((priceAmt / btcPrice) * 100_000_000)));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchInvoice = async (sats) => {
    if (!sellerLnAddr) { setError("No lightning address found for this seller."); setPhase("error"); return; }
    setPhase("loading");
    try {
      const lnurlData = await fetchLnurlData(sellerLnAddr);
      const { callback, allowsNostr, commentAllowed, minSendable = 1000, maxSendable = 10_000_000_000_000 } = lnurlData;
      if (!callback) throw new Error("No LNURL callback");

      const msats = sats * 1000;
      if (msats < minSendable) throw new Error(`Minimum is ${Math.ceil(minSendable / 1000)} sats`);
      if (msats > maxSendable) throw new Error(`Maximum is ${Math.floor(maxSendable / 1000)} sats`);

      const description = `Zap Out: ${title}`;
      let pr = null;
      let signed = null;

      // NIP-57 zap request
      if (allowsNostr !== false && window.nostr) {
        try {
          const zapRequestTemplate = makeZapRequest({
            event: { id: event.id, pubkey: event.pubkey, kind: event.kind, tags: event.tags || [], content: event.content || "", created_at: event.created_at, sig: event.sig || "" },
            amount: msats,
            comment: description,
            relays: RELAYS,
          });
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

      // Plain LNURL-pay fallback
      if (!pr) {
        const callbackUrl = new URL(callback);
        callbackUrl.searchParams.set("amount", String(msats));
        if (commentAllowed && description.length <= commentAllowed) {
          callbackUrl.searchParams.set("comment", description);
        }
        const invoiceRes = await fetch(callbackUrl.toString(), { signal: AbortSignal.timeout(10000) });
        const invoiceData = await invoiceRes.json();
        if (invoiceData.status === "ERROR") throw new Error(invoiceData.reason || "Invoice error");
        if (!invoiceData.pr) throw new Error("No invoice returned");
        pr = invoiceData.pr;
      }

      if (signed) {
        const paymentHash = decodeInvoice(pr)?.paymentHash;
        if (paymentHash) cacheZapReq(paymentHash, signed);
      }

      setInvoice(pr);
      if (walletConnected) {
        attemptWalletPay(pr);
      } else {
        setPhase("invoice");
      }
    } catch (e) {
      setError(e?.message || "Failed to fetch invoice");
      setPhase("error");
    }
  };

  const attemptWalletPay = async (inv) => {
    setPhase("paying");
    haptic.medium?.();
    const result = await payWithNWC(inv);
    if (result.ok) {
      haptic.heavy?.();
      setPhase("paid");
    } else {
      setError(result.reason || "Payment failed");
      setPhase("invoice");
    }
  };

  const handleRequest = () => {
    const sats = parseInt(amount);
    if (!sats || sats < 1) return;
    haptic.medium?.();
    fetchInvoice(sats);
  };

  const handleCopy = () => {
    haptic.light?.();
    navigator.clipboard.writeText(invoice).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  return (
    <Overlay onDismiss={onClose} centered className="zap-overlay">
      <div className="zap-modal noffer-modal" onClick={e => e.stopPropagation()}>

        <div className="zap-modal-header">
          <div>
            <div className="zap-modal-title">⚡ Zap Out</div>
            <div className="zap-modal-sub">{title}</div>
          </div>
          <button type="button" className="zap-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {phase === "amount" && (
          <>
            <input
              className="zap-input noffer-amount-input"
              type="number"
              min="1"
              placeholder="Amount in sats"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRequest()}
              autoFocus
            />
            <button
              className="zap-send-btn"
              onClick={handleRequest}
              disabled={!parseInt(amount)}
            >
              Request Invoice
            </button>
          </>
        )}

        {(phase === "loading" || phase === "paying") && (
          <div className="noffer-loading">
            <div className="noffer-spinner" />
            <span>{phase === "paying" ? "Paying with wallet…" : "Requesting invoice…"}</span>
          </div>
        )}

        {phase === "paid" && (
          <div className="noffer-paid">
            <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
            <span className="noffer-paid-label">Payment sent!</span>
            <button className="zap-send-btn" style={{ marginTop: 4 }} onClick={onClose}>Done</button>
          </div>
        )}

        {phase === "invoice" && (
          <div className="noffer-invoice">
            {error && <div className="noffer-error-msg" style={{ width: "100%", boxSizing: "border-box" }}>{error}</div>}
            <div className="noffer-qr">
              <QRCode
                value={`lightning:${invoice}`}
                size={300}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
                style={{ display: "block" }}
              />
            </div>
            <div className="noffer-invoice-string">
              <input
                className="noffer-invoice-input"
                readOnly
                value={invoice}
                onFocus={e => e.target.select()}
              />
              <button
                className={`noffer-invoice-copy-btn${copied ? " copied" : ""}`}
                type="button"
                onClick={handleCopy}
                aria-label={copied ? "Copied" : "Copy"}
                title={copied ? "Copied!" : "Copy"}
              >
                {copied
                  ? <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12" /></svg>
                  : <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                }
              </button>
            </div>
            {walletConnected && (
              <button className="zap-send-btn" style={{ width: "328px" }} onClick={() => attemptWalletPay(invoice)}>
                Pay with wallet
              </button>
            )}
          </div>
        )}

        {phase === "error" && (
          <div className="noffer-error">
            <div className="noffer-error-msg">{error}</div>
            <button className="zap-send-btn" onClick={() => { setError(""); setPhase("amount"); }}>
              Try again
            </button>
          </div>
        )}
      </div>
    </Overlay>
  );
}
