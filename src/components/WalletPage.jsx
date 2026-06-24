import { useCallback, useState, useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import { NWCClient } from "@getalby/sdk/nwc";
import Avatar from "./Avatar.jsx";
import { displayName, relativeTime, getZapReqFromCache } from "../utils.js";
import { decodeInvoice } from "@getalby/lightning-tools";
import { payWithNWC } from "../utils/nwcPay.js";
import { getZapPresets } from "../hooks/useZapSettings.js";

function zapReqFromDesc(tx) {
  try {
    if (tx.description?.trim().startsWith("{")) return JSON.parse(tx.description);
  } catch {}
  try {
    if (tx.invoice) {
      const desc = decodeInvoice(tx.invoice)?.description;
      if (desc?.trim().startsWith("{")) return JSON.parse(desc);
    }
  } catch {}
  return null;
}

// Returns a nostr-event-shaped object from wallet metadata or invoice description only.
// Cache is read separately below since it now uses a different flat format.
function getZapReq(tx) {
  if (tx.metadata?.nostr?.tags) return tx.metadata.nostr;
  return zapReqFromDesc(tx);
}

function nostrPubkeyFromTx(tx) {
  if (tx.type === "outgoing") return getZapReqFromCache(tx.payment_hash)?.receiver ?? null;
  const zr = getZapReq(tx);
  return tx.metadata?.nostr?.pubkey ?? zr?.pubkey ?? null;
}

function txComment(tx) {
  if (tx.metadata?.comment?.trim()) return tx.metadata.comment.trim();
  if (tx.type === "outgoing") return getZapReqFromCache(tx.payment_hash)?.content?.trim() ?? "";
  return getZapReq(tx)?.content?.trim() ?? "";
}

function txDescription(tx, profiles) {
  const pk = nostrPubkeyFromTx(tx);
  if (pk) return displayName(pk, profiles);
  if (tx.description?.trim() && !tx.description.trim().startsWith("{")) return tx.description.trim();
  return tx.type === "incoming" ? "Received" : "Sent";
}

function fmtBalance(msats) {
  if (msats === null) return "—";
  return Math.round(msats / 1000).toLocaleString("en-US").replace(/,/g, " ");
}

function fmtTxAmount(tx) {
  const sats = Math.round((tx.amount ?? 0) / 1000);
  const prefix = tx.type === "incoming" ? "+" : "−";
  return `${prefix}${sats.toLocaleString("en-US").replace(/,/g, " ")}`;
}

function fmtSatsFull(msats) {
  return Math.round((msats ?? 0) / 1000).toLocaleString("en-US").replace(/,/g, " ");
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function LightningIcon() {
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={2}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    </div>
  );
}

function RefreshIcon({ spinning }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      style={{ animation: spinning ? "spin .8s linear infinite" : "none" }}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function SendView({ onDismiss, onSuccess, recentRecipients, profiles, sendZap }) {
  const [invoice,   setInvoice]   = useState("");
  const [phase,     setPhase]     = useState("idle"); // idle | zap | paying | paid | error
  const [zapTarget, setZapTarget] = useState(null);
  const [zapAmount, setZapAmount] = useState(() => getZapPresets()[0] ?? 21);
  const [zapCustom, setZapCustom] = useState("");
  const [zapMsg,    setZapMsg]    = useState("");
  const [error,     setError]     = useState("");

  const zapPresets      = getZapPresets();
  const effectiveAmount = zapCustom ? (parseInt(zapCustom) || 0) : zapAmount;

  const handlePay = async () => {
    const inv = invoice.trim();
    if (!inv) return;
    setPhase("paying");
    const result = await payWithNWC(inv);
    if (result.ok) { setPhase("paid"); onSuccess?.(); }
    else { setError(result.reason || "Payment failed"); setPhase("error"); }
  };

  const handleZap = async () => {
    if (!effectiveAmount || !zapTarget) return;
    const profile = profiles?.[zapTarget];
    const lnAddr  = profile?.lud16 || profile?.lud06;
    if (!lnAddr) { setError("No lightning address found for this user."); setPhase("error"); return; }
    if (!sendZap) { setError("Wallet not connected."); setPhase("error"); return; }
    setPhase("paying");
    const result = await sendZap({ amountSats: effectiveAmount, recipientLnAddr: lnAddr, recipientPubkey: zapTarget, msg: zapMsg });
    if (result.ok) { setPhase("paid"); onSuccess?.(); }
    else { setError(result.reason || "Payment failed"); setPhase("error"); }
  };

  const selectRecipient = (pk) => { setZapTarget(pk); setZapAmount(zapPresets[0] ?? 21); setZapCustom(""); setZapMsg(""); setPhase("zap"); };
  const backToIdle      = () => { setZapTarget(null); setPhase("idle"); };
  const handleBack      = phase === "paying" ? undefined : phase === "zap" ? backToIdle : onDismiss;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px 12px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
        <button onClick={handleBack} disabled={!handleBack}
          style={{ background: "none", border: "none", cursor: handleBack ? "pointer" : "default", color: "var(--text-muted)", padding: "0 10px 0 0", fontSize: 22, lineHeight: 1, opacity: handleBack ? 1 : 0 }}>
          ‹
        </button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 600, color: "var(--text)", fontFamily: "'DM Sans',sans-serif" }}>
          {phase === "zap" ? `Zap ${displayName(zapTarget, profiles)}` : "Send"}
        </div>
        <div style={{ width: 30 }} />
      </div>

      <div style={{ padding: "16px 16px 32px", display: "flex", flexDirection: "column" }}>
        {/* Invoice paste — idle only */}
        {phase === "idle" && (
          <>
            <textarea
              placeholder="Paste a BOLT-11 invoice…"
              value={invoice}
              onChange={e => setInvoice(e.target.value)}
              style={{ width: "100%", minHeight: 80, resize: "vertical", padding: "11px 13px", background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", fontFamily: "monospace", fontSize: 12, outline: "none", boxSizing: "border-box" }}
            />
            <button className="zap-send-btn" onClick={handlePay} disabled={!invoice.trim()} style={{ opacity: invoice.trim() ? 1 : 0.45, marginTop: 10 }}>Pay</button>
          </>
        )}

        {/* Recents list — idle only */}
        {phase === "idle" && recentRecipients?.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", margin: "20px 0 8px" }}>Recents</div>
            <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
              {recentRecipients.map((pk, i) => (
                <button key={pk} onClick={() => selectRecipient(pk)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "none", border: "none", borderBottom: i < recentRecipients.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", textAlign: "left" }}>
                  <Avatar pk={pk} profiles={profiles} size={36} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", fontFamily: "'DM Sans',sans-serif", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {displayName(pk, profiles)}
                  </span>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth={2}><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Zap amount picker */}
        {phase === "zap" && (
          <>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <Avatar pk={zapTarget} profiles={profiles} size={64} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
              {zapPresets.map(sats => (
                <button key={sats} onClick={() => { setZapAmount(sats); setZapCustom(""); }}
                  style={{ padding: "10px 4px", borderRadius: 10, border: `1.5px solid ${!zapCustom && zapAmount === sats ? "var(--primary)" : "var(--border)"}`, background: !zapCustom && zapAmount === sats ? "var(--primary)" : "var(--surface)", color: !zapCustom && zapAmount === sats ? "white" : "var(--text)", fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {sats >= 1000 ? `${sats / 1000}k` : sats}
                </button>
              ))}
            </div>
            <input type="number" placeholder="Custom amount (sats)" value={zapCustom} onChange={e => setZapCustom(e.target.value)} className="noffer-amount-input" style={{ marginBottom: 8 }} />
            <textarea placeholder="Message (optional)" value={zapMsg} onChange={e => setZapMsg(e.target.value)}
              style={{ width: "100%", minHeight: 60, resize: "none", padding: "11px 13px", background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", fontFamily: "'DM Sans',sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 10 }}
            />
            <button className="zap-send-btn" onClick={handleZap} disabled={!effectiveAmount} style={{ opacity: effectiveAmount ? 1 : 0.45 }}>
              Zap {effectiveAmount ? (effectiveAmount >= 1000 ? `${(effectiveAmount/1000).toFixed(effectiveAmount >= 10000 ? 0 : 1)}k` : effectiveAmount) : "—"} sats
            </button>
          </>
        )}

        {phase === "paying" && (
          <div className="noffer-loading"><div className="noffer-spinner" /><span>Paying…</span></div>
        )}

        {phase === "paid" && (
          <div className="noffer-paid">
            <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
            <span className="noffer-paid-label">Payment sent!</span>
            <button className="zap-send-btn" style={{ marginTop: 4 }} onClick={onDismiss}>Done</button>
          </div>
        )}

        {phase === "error" && (
          <div className="noffer-error">
            <div className="noffer-error-msg">{error}</div>
            <button className="zap-send-btn" onClick={() => { setError(""); setPhase(zapTarget ? "zap" : "idle"); }}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiveView({ nwcUri, lnAddress, onDismiss }) {
  const [amount,  setAmount]  = useState("");
  const [memo,    setMemo]    = useState("");
  const [phase,   setPhase]   = useState("idle"); // idle | loading | invoice | error
  const [invoice, setInvoice] = useState("");
  const [error,   setError]   = useState("");
  const [copied,  setCopied]  = useState(false);

  const handleGenerate = async () => {
    const sats = parseInt(amount, 10);
    if (!sats || sats < 1) return;
    setPhase("loading");
    let client;
    try {
      client = new NWCClient({ nostrWalletConnectUrl: nwcUri });
      const res = await client.makeInvoice({ amount: sats * 1000, description: memo.trim() || "Circl payment" });
      const bolt11 = res.invoice ?? res.payment_request;
      if (!bolt11) throw new Error("No invoice returned");
      setInvoice(bolt11);
      setPhase("invoice");
    } catch (e) {
      setError(e?.message || "Failed to create invoice");
      setPhase("error");
    } finally {
      client?.close();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(invoice).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleBack = phase === "loading" ? undefined : onDismiss;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px 12px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
        <button onClick={handleBack} disabled={!handleBack}
          style={{ background: "none", border: "none", cursor: handleBack ? "pointer" : "default", color: "var(--text-muted)", padding: "0 10px 0 0", fontSize: 22, lineHeight: 1, opacity: handleBack ? 1 : 0 }}>
          ‹
        </button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 600, color: "var(--text)", fontFamily: "'DM Sans',sans-serif" }}>Receive</div>
        <div style={{ width: 30 }} />
      </div>

      {lnAddress && (
        <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "24px 24px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ background: "#fff", padding: 16, width: "100%", boxSizing: "border-box" }}>
            <QRCode value={`lightning:${lnAddress}`} style={{ width: "100%", height: "auto", display: "block" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{lnAddress}</span>
            <button onClick={() => navigator.clipboard.writeText(lnAddress)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, display: "flex", alignItems: "center" }} aria-label="Copy lightning address">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: "16px 16px 32px", display: "flex", flexDirection: "column" }}>
        {phase === "idle" && (
          <>
            <input
              type="number"
              placeholder="Amount (sats)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              autoFocus
              min={1}
              className="noffer-amount-input"
            />
            <input
              type="text"
              placeholder="Memo (optional)"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              className="noffer-amount-input"
              style={{ marginTop: 8 }}
            />
            <button
              className="zap-send-btn"
              onClick={handleGenerate}
              disabled={!parseInt(amount, 10)}
              style={{ opacity: parseInt(amount, 10) > 0 ? 1 : 0.45, marginTop: 10 }}
            >
              Generate Invoice
            </button>
          </>
        )}

        {phase === "loading" && (
          <div className="noffer-loading">
            <div className="noffer-spinner" />
            <span>Creating invoice…</span>
          </div>
        )}

        {phase === "invoice" && (
          <div className="noffer-invoice">
            <div className="noffer-qr">
              <QRCode value={`lightning:${invoice}`} size={300} bgColor="#ffffff" fgColor="#000000" level="M" style={{ display: "block" }} />
            </div>
            <div className="noffer-invoice-string">
              <input className="noffer-invoice-input" readOnly value={invoice} onFocus={e => e.target.select()} />
              <button className={`noffer-invoice-copy-btn${copied ? " copied" : ""}`} type="button" onClick={handleCopy} aria-label={copied ? "Copied" : "Copy"}>
                {copied
                  ? <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                }
              </button>
            </div>
            <button className="zap-send-btn" onClick={onDismiss}>Done</button>
          </div>
        )}

        {phase === "error" && (
          <div className="noffer-error">
            <div className="noffer-error-msg">{error}</div>
            <button className="zap-send-btn" onClick={() => { setError(""); setPhase("idle"); }}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WalletPage({ wallet, balance, transactions, flow24h, hasMore, loadMore, loadingMore, loading, error, onRefresh, profiles, onOpenProfile, onOpenTransaction, sendZap }) {
  const handleRefresh = useCallback(() => { if (!loading) onRefresh?.(); }, [loading, onRefresh]);
  const [sendOpen,    setSendOpen]    = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMore?.(); }, { threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore, sendOpen]);

  if (!wallet?.nwc_uri) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No wallet connected</div>
        <div className="empty-state-sub">Connect a wallet in Settings to see your balance and transaction history</div>
      </div>
    );
  }

  const seenHashes = new Set();
  const settled = transactions.filter(tx => {
    if (tx.state !== "settled") return false;
    if (!tx.payment_hash) return true;
    if (seenHashes.has(tx.payment_hash)) return false;
    seenHashes.add(tx.payment_hash);
    return true;
  });

  const flow = flow24h ?? { satsIn: 0, satsOut: 0, feesPaid: 0, net: 0 };

  const recentRecipients = [];
  const seenRec = new Set();
  for (const tx of settled) {
    if (tx.type !== "outgoing") continue;
    const pk = nostrPubkeyFromTx(tx);
    if (!pk || seenRec.has(pk)) continue;
    seenRec.add(pk);
    recentRecipients.push(pk);
    if (recentRecipients.length >= 21) break;
  }

  if (sendOpen) {
    return (
      <SendView
        onDismiss={() => setSendOpen(false)}
        onSuccess={() => { setSendOpen(false); onRefresh?.(); }}
        recentRecipients={recentRecipients}
        profiles={profiles}
        sendZap={sendZap}
      />
    );
  }

  if (receiveOpen) {
    return <ReceiveView nwcUri={wallet.nwc_uri} lnAddress={wallet.lightning_address} onDismiss={() => setReceiveOpen(false)} />;
  }

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* Balance card */}
      <div style={{ margin: "16px 16px 4px", padding: "24px 20px 20px", background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", textAlign: "center", position: "relative" }}>
        <button onClick={handleRefresh} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: loading ? "default" : "pointer", color: "var(--text-muted)", padding: 4, display: "flex", borderRadius: 6 }}>
          <RefreshIcon spinning={loading} />
        </button>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>Balance</span>
        {error ? (
          <div style={{ fontSize: 13, color: "#E05C8A", fontFamily: "'DM Sans',sans-serif", marginTop: 8 }}>{error}</div>
        ) : (
          <div style={{ marginTop: 6, display: "flex", justifyContent: "center" }}>
            <span style={{ position: "relative", fontSize: 42, fontWeight: 700, color: "var(--text)", fontFamily: "'DM Sans',sans-serif", letterSpacing: "-0.02em", lineHeight: 1 }}>
              {loading && balance === null ? "—" : fmtBalance(balance)}
              <span style={{ position: "absolute", left: "calc(100% + 6px)", bottom: 6, fontSize: 13, fontWeight: 500, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap" }}>sats</span>
            </span>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button onClick={() => setSendOpen(true)} style={{ flex: 1, padding: "10px 0", background: "var(--primary)", color: "white", border: "none", borderRadius: 12, fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
            Send
          </button>
          <button onClick={() => setReceiveOpen(true)} style={{ flex: 1, padding: "10px 0", background: "var(--surface2, var(--surface))", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 12, fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
            Receive
          </button>
        </div>
      </div>

      {/* Satsflow widget */}
      <div style={{ margin: "4px 16px 8px", padding: "16px 20px 14px", background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", textAlign: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>Satsflow · 24h</span>
        <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", justifyContent: "center", gap: 5 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: flow.net >= 0 ? "#4CAF50" : "#E05C8A", fontFamily: "'DM Sans',sans-serif", letterSpacing: "-0.02em", lineHeight: 1 }}>
            {flow.net >= 0 ? "+" : "−"}{Math.abs(flow.net).toLocaleString("en-US").replace(/,/g, " ")}
          </span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif" }}>sats</span>
        </div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 0, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          {[
            { label: "In",   value: `+${flow.satsIn.toLocaleString("en-US").replace(/,/g, " ")}`,   color: "#4CAF50" },
            { label: "Out",  value: `−${flow.satsOut.toLocaleString("en-US").replace(/,/g, " ")}`,  color: "var(--text)" },
            { label: "Fees", value: `−${flow.feesPaid.toLocaleString("en-US").replace(/,/g, " ")}`, color: "var(--text-muted)" },
          ].map(({ label, value, color }, i, arr) => (
            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: "'DM Sans',sans-serif" }}>{value}</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions section label — hidden while initial load */}
      {(!loading || settled.length > 0) && (
        <div style={{ margin: "12px 16px 6px" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Transactions
          </span>
        </div>
      )}

      {!loading && !settled.length ? (
        <div style={{ padding: "32px 16px", textAlign: "center" }}>
          <div style={{ fontSize: "var(--font-base)", color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif" }}>No transactions yet</div>
        </div>
      ) : (
        <div style={{ margin: "0 16px 24px", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          {settled.map((tx, i) => {
            const pk         = nostrPubkeyFromTx(tx);
            const label      = txDescription(tx, profiles);
            const amountStr  = fmtTxAmount(tx);
            const isIncoming = tx.type === "incoming";
            const comment    = txComment(tx);
            const ts         = tx.settled_at || tx.created_at;

            return (
              <div key={tx.payment_hash ?? i}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i < settled.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer" }}
                onClick={() => onOpenTransaction?.(tx)}
              >
                {pk ? <Avatar pk={pk} profiles={profiles} size={36} /> : <LightningIcon />}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--font-base)", fontWeight: 500, color: "var(--text)", fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {label}<span style={{ color: "var(--text-faint)", fontWeight: 400 }}> · {relativeTime(ts)}</span>
                  </div>
                  {comment && (
                    <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {comment}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "var(--font-base)", fontWeight: 600, fontFamily: "'DM Sans',sans-serif", color: isIncoming ? "#4CAF50" : "var(--text)" }}>
                    {amountStr}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", marginTop: 1 }}>sats</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loadingMore && (
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 24px" }}>
          <div style={{ width: 18, height: 18, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        </div>
      )}

    </div>

    </>
  );
}
