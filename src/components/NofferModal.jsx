import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import QRCode from "react-qr-code";
import Overlay from "./Overlay.jsx";
import { haptic } from "../utils.js";
import { ClinkSDK, decodeBech32, generateSecretKey, OfferPriceType } from "@shocknet/clink-sdk";
import { payWithNWC, hasWallet } from "../utils/nwcPay.js";

export default function NofferModal({ value, onDismiss }) {
  const decoded = useMemo(() => {
    try {
      const d = decodeBech32(value);
      return d?.type === "noffer" ? d.data : null;
    } catch { return null; }
  }, [value]);

  const isFixed   = decoded?.priceType === OfferPriceType.Fixed;
  const fixedSats = decoded?.price || 0;
  const walletConnected = hasWallet();

  const [phase,   setPhase]   = useState("amount"); // "amount"|"loading"|"invoice"|"paying"|"paid"|"error"
  const [amount,  setAmount]  = useState(isFixed ? String(fixedSats) : "");
  const [invoice, setInvoice] = useState("");
  const [error,   setError]   = useState("");
  const [copied,  setCopied]  = useState(false);

  // Auto-fetch for fixed-price offers
  useEffect(() => {
    if (isFixed && fixedSats > 0) fetchInvoice(fixedSats);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchInvoice = async (sats) => {
    if (!decoded) { setError("Could not decode offer."); setPhase("error"); return; }
    setPhase("loading");
    try {
      const sdk = new ClinkSDK({
        privateKey: generateSecretKey(),
        relays: [decoded.relay],
        toPubKey: decoded.pubkey,
      });
      const res = await sdk.Noffer({
        offer: decoded.offer,
        amount_sats: sats,
        description: "Payment",
      });
      if (res?.bolt11) {
        setInvoice(res.bolt11);
        if (walletConnected) {
          attemptWalletPay(res.bolt11);
        } else {
          setPhase("invoice");
        }
      } else {
        const msg = res?.error || "No invoice returned";
        const rangeHint = res?.range ? ` (${res.range.min}–${res.range.max} sats)` : "";
        throw new Error(msg + rangeHint);
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

  return createPortal(
    <Overlay onDismiss={onDismiss} centered className="zap-overlay">
      <div className="zap-modal noffer-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="zap-modal-header">
          <div>
            <div className="zap-modal-title">⚡ Pay Offer</div>
            <div className="zap-modal-sub">CLINK · Noffer</div>
          </div>
          <button type="button" className="zap-modal-close" onClick={onDismiss} aria-label="Close">×</button>
        </div>

        {/* Amount input */}
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

        {/* Loading / paying */}
        {(phase === "loading" || phase === "paying") && (
          <div className="noffer-loading">
            <div className="noffer-spinner" />
            <span>{phase === "paying" ? "Paying with wallet…" : "Requesting invoice…"}</span>
          </div>
        )}

        {/* Paid */}
        {phase === "paid" && (
          <div className="noffer-paid">
            <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
            <span className="noffer-paid-label">Payment sent!</span>
            <button className="zap-send-btn" style={{ marginTop: 4 }} onClick={onDismiss}>Done</button>
          </div>
        )}

        {/* Invoice + QR */}
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

        {/* Error */}
        {phase === "error" && (
          <div className="noffer-error">
            <div className="noffer-error-msg">{error}</div>
            <button className="zap-send-btn" onClick={() => { setError(""); setPhase("amount"); }}>
              Try again
            </button>
          </div>
        )}
      </div>
    </Overlay>,
    document.body
  );
}
