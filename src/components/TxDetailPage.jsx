import { useState } from "react";
import Avatar from "./Avatar.jsx";
import { Bk } from "./icons.jsx";
import { displayName } from "../utils.js";

function parseZapRequest(tx) {
  try {
    if (tx.description?.trim().startsWith("{")) return JSON.parse(tx.description);
  } catch {}
  return null;
}

function nostrPubkeyFromTx(tx) {
  const zr = parseZapRequest(tx);
  if (tx.type === "outgoing") {
    // For zaps we sent, the recipient is the `p` tag of the zap request
    const pTag = zr?.tags?.find(t => t[0] === "p")?.[1];
    return pTag ?? tx.metadata?.nostr?.pubkey ?? null;
  }
  // For incoming zaps the sender signed the request — their pubkey is the top-level field
  return tx.metadata?.nostr?.pubkey ?? zr?.pubkey ?? null;
}

function txComment(tx) {
  if (tx.metadata?.comment?.trim()) return tx.metadata.comment.trim();
  const zr = parseZapRequest(tx);
  return zr?.content?.trim() ?? "";
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function fmtSatsFull(msats) {
  return Math.round((msats ?? 0) / 1000).toLocaleString("en-US").replace(/,/g, " ");
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "var(--text-muted)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", flexShrink: 0 }}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function DetailRow({ label, value, mono = false, wrap = false }) {
  if (!value) return null;
  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <span style={{
          fontSize: 13, color: "var(--text)",
          fontFamily: mono ? "monospace" : "'DM Sans',sans-serif",
          wordBreak: wrap ? "break-all" : "normal",
          whiteSpace: wrap ? "normal" : "nowrap",
          overflow: wrap ? "visible" : "hidden",
          textOverflow: wrap ? "clip" : "ellipsis",
          flex: 1,
        }}>
          {value}
        </span>
        {mono && <CopyButton text={value} />}
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ padding: "14px 16px 4px", fontSize: 11, fontWeight: 600, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {children}
    </div>
  );
}

export default function TxDetailPage({ tx, profiles, onBack, onOpenProfile }) {
  const pk         = nostrPubkeyFromTx(tx);
  const name       = pk ? displayName(pk, profiles) : null;
  const comment    = txComment(tx);
  const isIncoming = tx.type === "incoming";
  const feesSats   = tx.fees_paid ? Math.round(tx.fees_paid / 1000) : 0;
  const zapReq     = parseZapRequest(tx);

  // Extract structured fields from the zap request
  const zapReqId        = zapReq?.id ?? null;
  const zapReqSig       = zapReq?.sig ?? null;
  const zapReqCreatedAt = zapReq?.created_at ? fmtDate(zapReq.created_at) : null;
  const zapReqSenderPk  = zapReq?.pubkey ?? null;
  const zapReqTags      = zapReq?.tags ?? [];
  const zappedNoteId    = zapReqTags.find(t => t[0] === "e")?.[1] ?? null;
  const zapReqRelays    = (() => { const r = zapReqTags.find(t => t[0] === "relays"); return r ? r.slice(1).join(", ") : null; })();
  const zapReqAmountTag = zapReqTags.find(t => t[0] === "amount")?.[1];
  const zapReqAmtSats   = zapReqAmountTag ? `${Math.round(Number(zapReqAmountTag) / 1000)} sats` : null;

  // tx.metadata.nostr has { pubkey, tags } — show tags not already covered above
  const metaNostrTags   = tx.metadata?.nostr?.tags;

  const hasNostrData = zapReq || tx.metadata?.nostr;

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <button className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Transaction</span>
      </div>

      {/* Amount hero */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 16px 24px", borderBottom: "1px solid var(--border)" }}>
        {pk && (
          <div style={{ marginBottom: 12, cursor: "pointer" }} onClick={() => onOpenProfile?.(pk)}>
            <Avatar pk={pk} profiles={profiles} size={56} />
          </div>
        )}
        <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em", color: isIncoming ? "#4CAF50" : "var(--text)", fontFamily: "'DM Sans',sans-serif", lineHeight: 1 }}>
          {isIncoming ? "+" : "−"}{fmtSatsFull(tx.amount)}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", marginTop: 4 }}>sats</div>
        {comment && (
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", marginTop: 10, fontStyle: "italic", textAlign: "center" }}>
            "{comment}"
          </div>
        )}
      </div>

      <div style={{ paddingBottom: 40 }}>
        {/* Payment details */}
        <SectionLabel>Payment</SectionLabel>
        <DetailRow label="Direction"    value={isIncoming ? "Received" : "Sent"} />
        <DetailRow label="Status"       value={tx.state} />
        {name && <DetailRow label={isIncoming ? "From" : "To"} value={name} />}
        <DetailRow label="Date"         value={fmtDate(tx.settled_at || tx.created_at)} />
        {feesSats > 0 && <DetailRow label="Fees" value={`${feesSats} sats`} />}
        <DetailRow label="Payment Hash" value={tx.payment_hash} mono wrap />
        {tx.preimage && <DetailRow label="Preimage" value={tx.preimage} mono wrap />}
        {tx.invoice  && <DetailRow label="Invoice"  value={tx.invoice}  mono wrap />}

        {/* Nostr / Zap Request (NIP-57) */}
        {hasNostrData && (
          <>
            <SectionLabel>Zap Request (NIP-57)</SectionLabel>
            {zapReqId        && <DetailRow label="Event ID"      value={zapReqId}        mono wrap />}
            {zapReqSenderPk  && <DetailRow label="Sender Pubkey" value={zapReqSenderPk}  mono wrap />}
            {pk && pk !== zapReqSenderPk && <DetailRow label={isIncoming ? "Recipient Pubkey" : "Recipient Pubkey"} value={pk} mono wrap />}
            {zappedNoteId    && <DetailRow label="Zapped Note ID" value={zappedNoteId}   mono wrap />}
            {zapReqAmtSats   && <DetailRow label="Requested Amount" value={zapReqAmtSats} />}
            {zapReqCreatedAt && <DetailRow label="Request Created"  value={zapReqCreatedAt} />}
            {zapReqRelays    && <DetailRow label="Relays"           value={zapReqRelays}  wrap />}
            {zapReqSig       && <DetailRow label="Signature"        value={zapReqSig}     mono wrap />}
            {metaNostrTags   && <DetailRow label="Metadata Tags"    value={JSON.stringify(metaNostrTags, null, 2)} mono wrap />}
          </>
        )}
      </div>
    </div>
  );
}
