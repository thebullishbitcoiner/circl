import { useState } from "react";
import Overlay from "./Overlay.jsx";
import { displayName, haptic } from "../utils.js";
import { ZAP_PRESETS } from "../constants.js";

export default function ZapModal({ event, profiles, onZap, onDismiss, defaultAmount = 21, defaultMsg = "" }) {
  const presetSats = ZAP_PRESETS.map(p => p.sats);
  const isPreset   = presetSats.includes(defaultAmount);

  const [selected, setSelected] = useState(isPreset ? defaultAmount : presetSats[0]);
  const [custom,   setCustom]   = useState(!isPreset ? String(defaultAmount) : "");
  const [msg,      setMsg]      = useState(defaultMsg);
  const amount = custom ? parseInt(custom) || 0 : selected;

  const handleSend = () => {
    if (!amount) return;
    haptic.heavy();
    onZap?.({ amount, msg });
    onDismiss?.();
  };

  return (
    <Overlay onDismiss={onDismiss} centered className="zap-overlay" noClickOutside>
      <div className="zap-modal" onClick={e => e.stopPropagation()}>
        <div className="zap-modal-header">
          <div>
            <div className="zap-modal-title">Zap {displayName(event.pubkey, profiles)}</div>
            <div className="zap-modal-sub">How many sats?</div>
          </div>
          <button type="button" className="zap-modal-close" onClick={onDismiss} aria-label="Close">×</button>
        </div>
        <div className="zap-presets">
          {ZAP_PRESETS.map(p => (
            <button key={p.sats}
              className={`zap-preset${selected === p.sats && !custom ? " sel" : ""}`}
              onClick={() => { setSelected(p.sats); setCustom(""); }}>
              {p.sats >= 1000 ? `${p.sats / 1000}k` : p.sats}
              {p.label && <span className="zap-preset-label">{p.label}</span>}
            </button>
          ))}
        </div>
        <div className="zap-custom-row">
          <input className="zap-input" placeholder="Custom amount (sats)"
            type="number" min="1" value={custom}
            onChange={e => setCustom(e.target.value)} />
        </div>
        <textarea className="zap-input zap-msg" placeholder="Add a message… (optional)"
          value={msg} onChange={e => setMsg(e.target.value)} />
        <button className="zap-send-btn" onClick={handleSend} disabled={!amount}>
          Zap {amount >= 1000 ? `${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k` : amount} sats
        </button>
      </div>
    </Overlay>
  );
}
