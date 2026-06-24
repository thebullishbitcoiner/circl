import { useCallback, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import QRCode from "react-qr-code";
import { NWCClient } from "@getalby/sdk/nwc";
import Avatar from "./Avatar.jsx";
import { displayName, relativeTime, getZapReqFromCache } from "../utils.js";
import { decodeInvoice } from "@getalby/lightning-tools";
import { payWithNWC } from "../utils/nwcPay.js";

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

function getZapReq(tx) {
  if (tx.metadata?.nostr?.tags) return tx.metadata.nostr;
  const fromDesc = zapReqFromDesc(tx);
  if (fromDesc) return fromDesc;
  if (tx.type === "outgoing" && tx.payment_hash) return getZapReqFromCache(tx.payment_hash);
  return null;
}

function nostrPubkeyFromTx(tx) {
  const zr = getZapReq(tx);
  if (tx.type === "outgoing") {
    // Recipient is the p-tag of the zap request we signed
    return zr?.tags?.find(t => t[0] === "p")?.[1] ?? null;
  }
  // For incoming, the sender is the pubkey who signed the zap request
  return tx.metadata?.nostr?.pubkey ?? zr?.pubkey ?? null;
}

function txComment(tx) {
  if (tx.metadata?.comment?.trim()) return tx.metadata.comment.trim();
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

function SendSheet({ onDismiss, onSuccess }) {
  const [invoice, setInvoice] = useState("");
  const [phase,   setPhase]   = useState("idle"); // idle | paying | paid | error
  const [error,   setError]   = useState("");

  const handlePay = async () => {
    const inv = invoice.trim();
    if (!inv) return;
    setPhase("paying");
    const result = await payWithNWC(inv);
    if (result.ok) {
      setPhase("paid");
      onSuccess?.();
    } else {
      setError(result.reason || "Payment failed");
      setPhase("error");
    }
  };

  const col = document.querySelector(".feed-main") ?? document.body;
  return createPortal(
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .15s ease" }} onClick={phase === "paying" ? undefined : onDismiss}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg)", borderRadius: 20, padding: "24px 20px 20px", width: 360, maxWidth: "calc(100% - 32px)", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", fontFamily: "'DM Sans',sans-serif", marginBottom: 14, textAlign: "center" }}>Send</div>

        {phase === "idle" && (
          <>
            <textarea
              placeholder="Paste a BOLT-11 invoice…"
              value={invoice}
              onChange={e => setInvoice(e.target.value)}
              autoFocus
              style={{ width: "100%", minHeight: 90, resize: "vertical", padding: "11px 13px", background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", fontFamily: "monospace", fontSize: 12, outline: "none", boxSizing: "border-box", marginTop: 4 }}
            />
            <button
              className="zap-send-btn"
              onClick={handlePay}
              disabled={!invoice.trim()}
              style={{ opacity: invoice.trim() ? 1 : 0.45 }}
            >
              Pay
            </button>
          </>
        )}

        {phase === "paying" && (
          <div className="noffer-loading">
            <div className="noffer-spinner" />
            <span>Paying…</span>
          </div>
        )}

        {phase === "paid" && (
          <div className="noffer-paid">
            <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2}>
              <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
            </svg>
            <span className="noffer-paid-label">Payment sent!</span>
            <button className="zap-send-btn" style={{ marginTop: 4 }} onClick={onDismiss}>Done</button>
          </div>
        )}

        {phase === "error" && (
          <div className="noffer-error">
            <div className="noffer-error-msg">{error}</div>
            <button className="zap-send-btn" onClick={() => { setError(""); setPhase("idle"); }}>Try again</button>
          </div>
        )}
      </div>
    </div>,
    col
  );
}

function ReceiveSheet({ nwcUri, onDismiss }) {
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

  const col = document.querySelector(".feed-main") ?? document.body;
  return createPortal(
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .15s ease" }} onClick={phase === "loading" ? undefined : onDismiss}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg)", borderRadius: 20, padding: "24px 20px 20px", width: 360, maxWidth: "calc(100% - 32px)", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", fontFamily: "'DM Sans',sans-serif", marginBottom: 14, textAlign: "center" }}>Receive</div>

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
              style={{ marginTop: 4 }}
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
              style={{ opacity: parseInt(amount, 10) > 0 ? 1 : 0.45 }}
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
            <button className="zap-send-btn" style={{ width: "328px" }} onClick={onDismiss}>Done</button>
          </div>
        )}

        {phase === "error" && (
          <div className="noffer-error">
            <div className="noffer-error-msg">{error}</div>
            <button className="zap-send-btn" onClick={() => { setError(""); setPhase("idle"); }}>Try again</button>
          </div>
        )}
      </div>
    </div>,
    col
  );
}

export default function WalletPage({ wallet, balance, transactions, flow24h, hasMore, loadMore, loadingMore, loading, error, onRefresh, profiles, onOpenProfile, onOpenTransaction }) {
  const handleRefresh = useCallback(() => { if (!loading) onRefresh?.(); }, [loading, onRefresh]);
  const [sendOpen,    setSendOpen]    = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMore?.(); }, { threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

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

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* Balance card */}
      <div style={{ margin: "16px 16px 4px", padding: "20px 20px 18px", background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>Balance</span>
          <button onClick={handleRefresh} style={{ background: "none", border: "none", cursor: loading ? "default" : "pointer", color: "var(--text-muted)", padding: 4, display: "flex", borderRadius: 6 }}>
            <RefreshIcon spinning={loading} />
          </button>
        </div>
        {error ? (
          <div style={{ fontSize: 13, color: "#E05C8A", fontFamily: "'DM Sans',sans-serif" }}>{error}</div>
        ) : (
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: "var(--text)", fontFamily: "'DM Sans',sans-serif", letterSpacing: "-0.02em", lineHeight: 1 }}>
              {loading && balance === null ? "—" : fmtBalance(balance)}
            </span>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif" }}>sats</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
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

      {/* Transactions section label */}
      <div style={{ margin: "12px 16px 6px" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Transactions
        </span>
      </div>

      {loading && !settled.length ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
          <div style={{ width: 20, height: 20, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        </div>
      ) : !settled.length ? (
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

    {sendOpen    && <SendSheet    onDismiss={() => setSendOpen(false)}    onSuccess={() => { setSendOpen(false);    onRefresh?.(); }} />}
    {receiveOpen && <ReceiveSheet nwcUri={wallet.nwc_uri} onDismiss={() => setReceiveOpen(false)} />}
    </>
  );
}
