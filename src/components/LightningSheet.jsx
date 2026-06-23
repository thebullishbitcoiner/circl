import { useState } from "react";
import { createPortal } from "react-dom";
import Overlay from "./Overlay.jsx";
import ZapModal from "./ZapModal.jsx";
import NofferModal from "./NofferModal.jsx";
import { displayName, haptic } from "../utils.js";

function truncate(str, max = 30) {
  if (!str || str.length <= max) return str;
  return `${str.slice(0, 14)}…${str.slice(-10)}`;
}

function BoltIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export default function LightningSheet({
  pubkey,
  profile,
  profiles,
  sendZap,
  defaultZapAmount = 21,
  defaultZapMsg = "",
  onZapFail,
  onDismiss,
  onZapSuccess,
}) {
  const [showZapModal, setShowZapModal] = useState(false);
  const [showNoffer,   setShowNoffer]   = useState(false);
  const [copied,       setCopied]       = useState(null); // "lud16" | "lud06" | "noffer"

  const lud16       = profile?.lud16 || null;
  const lud06       = profile?.lud06 || null;
  const nofferValue = profile?.clink_noffer || null;
  const name        = displayName(pubkey, profiles);

  // Which address to use for zapping — prefer lud16, fall back to lud06
  const zapAddr = lud16 || lud06;

  const handleCopy = (value, key) => {
    haptic.light?.();
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleZap = async ({ amount, msg }) => {
    if (!sendZap) { onZapFail?.("no_wallet"); return; }
    if (!zapAddr)  { onZapFail?.("no_lud16");  return; }
    onDismiss?.();
    onZapSuccess?.();
    const result = await sendZap({
      amountSats: amount,
      recipientLnAddr: zapAddr,
      recipientPubkey: pubkey,
      msg,
    });
    if (!result.ok) onZapFail?.(result.reason);
  };

  return createPortal(
    <>
      <Overlay onDismiss={onDismiss}>
        <div className="action-sheet" onClick={e => e.stopPropagation()}>
          <div className="action-sheet-handle" />
          <div className="action-sheet-title">Pay {name}</div>

          {lud16 && (
            <div className="lightning-sheet-row">
              <div className="lightning-sheet-row-meta">
                <BoltIcon size={14} color="var(--lightning-accent)" />
                <div>
                  <div className="lightning-sheet-label">Lightning address</div>
                  <div className="lightning-sheet-value">{lud16}</div>
                </div>
              </div>
              <div className="lightning-sheet-actions">
                <button
                  className={`lnsheet-btn${copied === "lud16" ? " copied" : ""}`}
                  onClick={() => handleCopy(lud16, "lud16")}
                >
                  {copied === "lud16"
                    ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                    : "Copy"}
                </button>
                <button
                  className="lnsheet-btn primary"
                  onClick={() => { haptic.medium?.(); setShowZapModal(true); }}
                >
                  Zap ⚡
                </button>
              </div>
            </div>
          )}

          {lud06 && (
            <div className="lightning-sheet-row">
              <div className="lightning-sheet-row-meta">
                <BoltIcon size={14} color="var(--lightning-accent)" />
                <div>
                  <div className="lightning-sheet-label">LNURL</div>
                  <div className="lightning-sheet-value">{truncate(lud06)}</div>
                </div>
              </div>
              <div className="lightning-sheet-actions">
                <button
                  className={`lnsheet-btn${copied === "lud06" ? " copied" : ""}`}
                  onClick={() => handleCopy(lud06, "lud06")}
                >
                  {copied === "lud06"
                    ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                    : "Copy"}
                </button>
                {/* Only show Zap on lud06 row if there's no lud16 to avoid duplicate buttons */}
                {!lud16 && (
                  <button
                    className="lnsheet-btn primary"
                    onClick={() => { haptic.medium?.(); setShowZapModal(true); }}
                  >
                    Zap ⚡
                  </button>
                )}
              </div>
            </div>
          )}

          {nofferValue && (
            <div className="lightning-sheet-row">
              <div className="lightning-sheet-row-meta">
                <BoltIcon size={14} color="var(--lightning-accent)" />
                <div>
                  <div className="lightning-sheet-label">Noffer · CLINK</div>
                  <div className="lightning-sheet-value">{truncate(nofferValue, 28)}</div>
                </div>
              </div>
              <div className="lightning-sheet-actions">
                <button
                  className={`lnsheet-btn${copied === "noffer" ? " copied" : ""}`}
                  onClick={() => handleCopy(nofferValue, "noffer")}
                >
                  {copied === "noffer"
                    ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                    : "Copy"}
                </button>
                <button
                  className="lnsheet-btn primary"
                  onClick={() => { haptic.medium?.(); setShowNoffer(true); }}
                >
                  Pay
                </button>
              </div>
            </div>
          )}

          <button className="action-sheet-cancel" onClick={onDismiss}>Cancel</button>
        </div>
      </Overlay>

      {showZapModal && (
        <ZapModal
          event={{ pubkey }}
          profiles={profiles}
          defaultAmount={defaultZapAmount}
          defaultMsg={defaultZapMsg}
          onZap={handleZap}
          onDismiss={() => setShowZapModal(false)}
        />
      )}

      {showNoffer && (
        <NofferModal value={nofferValue} onDismiss={() => setShowNoffer(false)} />
      )}
    </>,
    document.body
  );
}
