import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import QRCode from "react-qr-code";
import Overlay from "./Overlay.jsx";
import { haptic } from "../utils.js";
import { ClinkSDK, decodeBech32, generateSecretKey, OfferPriceType } from "@shocknet/clink-sdk";

export default function NofferModal({ value, onDismiss }) {
  const decoded = useMemo(() => {
    try {
      const d = decodeBech32(value);
      return d?.type === "noffer" ? d.data : null;
    } catch { return null; }
  }, [value]);

  const isFixed      = decoded?.priceType === OfferPriceType.Fixed;
  const fixedSats    = decoded?.price || 0;

  const [phase,    setPhase]    = useState("amount"); // "amount"|"loading"|"invoice"|"error"
  const [amount,   setAmount]   = useState(isFixed ? String(fixedSats) : "");
  const [invoice,  setInvoice]  = useState("");
  const [error,    setError]    = useState("");
  const [copied,   setCopied]   = useState(false);

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
        setPhase("invoice");
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

  const handlePay = () => {
    haptic.medium?.();
    window.open(`lightning:${invoice}`, "_blank");
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

        {/* Loading */}
        {phase === "loading" && (
          <div className="noffer-loading">
            <div className="noffer-spinner" />
            <span>Requesting invoice…</span>
          </div>
        )}

        {/* Invoice + QR */}
        {phase === "invoice" && (
          <div className="noffer-invoice">
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
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="noffer-error">
            <div className="noffer-error-msg">{error}</div>
            <button className="zap-send-btn" onClick={() => setPhase("amount")}>
              Try again
            </button>
          </div>
        )}
      </div>
    </Overlay>,
    document.body
  );
}
