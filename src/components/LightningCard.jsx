import { useState, useMemo } from "react";
import { decodeInvoice } from "@getalby/lightning-tools";
import { haptic } from "../utils.js";
import NofferModal from "./NofferModal.jsx";

const LABELS = {
  "bolt11": "Lightning Invoice",
  "lnurl": "LNURL",
  "bolt12-offer": "BOLT-12 Offer",
  "bolt12-invoice": "BOLT-12 Invoice",
  "noffer": "Noffer",
  "unknown": "Lightning",
};

function formatSats(n) {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M sats`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k sats`;
  return `${n} sats`;
}

function truncate(str, max = 48) {
  if (!str || str.length <= max) return str;
  return `${str.slice(0, 10)}…${str.slice(-10)}`;
}

export default function LightningCard({ value, subtype }) {
  const [copied,      setCopied]      = useState(false);
  const [showNoffer,  setShowNoffer]  = useState(false);

  const decoded = useMemo(() => {
    if (subtype !== "bolt11") return null;
    try { return decodeInvoice(value); } catch { return null; }
  }, [value, subtype]);

  const sats = decoded?.satoshi ?? null;
  const description = decoded?.description?.trim() || null;
  const isExpired = decoded?.expiry && decoded?.timestamp
    ? (decoded.timestamp + decoded.expiry) * 1000 < Date.now()
    : false;

  const handleCopy = (e) => {
    e.stopPropagation();
    haptic.light?.();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  const handlePay = (e) => {
    e.stopPropagation();
    haptic.medium?.();
    if (subtype === "noffer") {
      setShowNoffer(true);
    } else {
      window.open(`lightning:${value}`, "_blank");
    }
  };

  return (
    <>
      <div className="lightning-card" onClick={e => e.stopPropagation()}>
        <div className="lightning-card-left">
          <span className="lightning-card-icon">⚡</span>
        </div>
        <div className="lightning-card-body">
          <span className="lightning-card-badge">{LABELS[subtype] ?? "Lightning"}</span>
          {sats != null && (
            <span className="lightning-card-amount">{formatSats(sats)}</span>
          )}
          {description && (
            <span className="lightning-card-desc">{description}</span>
          )}
          {!sats && !description && (
            <span className="lightning-card-id">{truncate(value)}</span>
          )}
          {isExpired && (
            <span className="lightning-card-expired">Expired</span>
          )}
        </div>
        <div className="lightning-card-actions">
          <button
            type="button"
            className={`lightning-card-copy-btn${copied ? " copied" : ""}`}
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy"}
            title={copied ? "Copied!" : "Copy"}
          >
            {copied
              ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12" /></svg>
              : <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            }
          </button>
          <button
            type="button"
            className="lightning-card-pay-btn"
            onClick={handlePay}
            aria-label="Pay"
          >
            Pay
          </button>
        </div>
      </div>

      {showNoffer && (
        <NofferModal value={value} onDismiss={() => setShowNoffer(false)} />
      )}
    </>
  );
}
