import { useState, useEffect } from "react";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import { Bk } from "./icons.jsx";
import { displayName, nip05OrNpub, relativeTime, getZapReqFromCache } from "../utils.js";
import { decodeInvoice } from "@getalby/lightning-tools";
import { pool } from "../nostr.js";
import { RELAYS } from "../constants.js";

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
    return zr?.tags?.find(t => t[0] === "p")?.[1] ?? null;
  }
  return tx.metadata?.nostr?.pubkey ?? zr?.pubkey ?? null;
}

function txComment(tx) {
  if (tx.metadata?.comment?.trim()) return tx.metadata.comment.trim();
  return getZapReq(tx)?.content?.trim() ?? "";
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

function DetailRow({ label, value, mono = false, wrap = false, pre = false }) {
  if (!value) return null;
  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </div>
        {mono && <CopyButton text={value} />}
      </div>
      {pre ? (
        <pre style={{ margin: 0, fontSize: 12, color: "var(--text)", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", overflowX: "auto" }}>
          {value}
        </pre>
      ) : (
        <span style={{
          fontSize: 13, color: "var(--text)",
          fontFamily: mono ? "monospace" : "'DM Sans',sans-serif",
          wordBreak: wrap ? "break-all" : "normal",
          whiteSpace: wrap ? "normal" : "nowrap",
          overflow: wrap ? "visible" : "hidden",
          textOverflow: wrap ? "clip" : "ellipsis",
          display: "block",
        }}>
          {value}
        </span>
      )}
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

function resolvedPubkeySource(tx) {
  const zr = getZapReq(tx);
  const metaNostr = tx.metadata?.nostr;
  if (tx.type === "outgoing") {
    const pTag = zr?.tags?.find(t => t[0] === "p")?.[1];
    if (pTag) return { pk: pTag, source: metaNostr?.tags ? "metadata.nostr p-tag" : "zap request p-tag" };
    return { pk: null, source: "none found" };
  }
  if (metaNostr?.pubkey) return { pk: metaNostr.pubkey, source: "metadata.nostr.pubkey" };
  if (zr?.pubkey) return { pk: zr.pubkey, source: "zap request pubkey field" };
  return { pk: null, source: "none found" };
}

function ZappedNote({ noteId, relayHints, profiles, onOpenProfile, onOpenThread }) {
  const [note, setNote] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!noteId) return;
    let found = false;
    let cancelled = false;
    const relays = relayHints?.length ? relayHints : RELAYS;
    const sub = pool.request(relays, [{ ids: [noteId], limit: 1 }]).subscribe({
      next: ev => { if (!cancelled) { found = true; setNote(ev); } },
      error: () => { if (!cancelled && !found) setFailed(true); },
      complete: () => { if (!cancelled && !found) setFailed(true); },
    });
    const timeout = setTimeout(() => { if (!found) setFailed(true); cancelled = true; sub.unsubscribe(); }, 8000);
    return () => { cancelled = true; clearTimeout(timeout); sub.unsubscribe(); };
  }, [noteId]);

  if (failed && !note) return (
    <div className="note-card" style={{ margin: "0 16px 16px", color: "var(--text-muted)", fontSize: 13, fontFamily: "'DM Sans',sans-serif", textAlign: "center" }}>
      Could not load note
    </div>
  );

  if (!note) return (
    <div className="note-card" style={{ margin: "0 16px 16px", color: "var(--text-muted)", fontSize: 13, fontFamily: "'DM Sans',sans-serif", textAlign: "center" }}>
      Loading note…
    </div>
  );

  return (
    <div className="note-card" style={{ margin: "0 16px 16px" }} onClick={() => onOpenThread?.(note)}>
      <div className="note-header">
        <div onClick={e => { e.stopPropagation(); onOpenProfile?.(note.pubkey); }} style={{ cursor: "pointer", flexShrink: 0 }}>
          <Avatar pk={note.pubkey} profiles={profiles} size={36} />
        </div>
        <div className="note-meta">
          <span className="note-name" style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(note.pubkey); }}>
            {displayName(note.pubkey, profiles)}
          </span>
          <span className="note-npub">{nip05OrNpub(note.pubkey, profiles)}</span>
          <span className="meta-dot" aria-hidden="true">·</span>
          <span className="note-time">{relativeTime(note.created_at)}</span>
        </div>
      </div>
      <NoteContent
        content={note.content}
        tags={note.tags}
        profiles={profiles}
        onOpenProfile={onOpenProfile}
        collapsible
      />
    </div>
  );
}

export default function TxDetailPage({ tx, profiles, onBack, onOpenProfile, onOpenThread }) {
  const pk         = nostrPubkeyFromTx(tx);
  const name       = pk ? displayName(pk, profiles) : null;
  const comment    = txComment(tx);
  const isIncoming = tx.type === "incoming";
  const feesSats   = tx.fees_paid ? Math.round(tx.fees_paid / 1000) : 0;
  const zapReq     = getZapReq(tx);

  const zapReqTags     = zapReq?.tags ?? [];
  const zappedNoteId   = zapReqTags.find(t => t[0] === "e")?.[1] ?? null;
  const zapReqRelayUrls = (() => { const r = zapReqTags.find(t => t[0] === "relays"); return r ? r.slice(1) : []; })();

  const { pk: resolvedPk, source: pkSource } = resolvedPubkeySource(tx);

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

        {/* Raw data for debugging */}
        <SectionLabel>Raw Data</SectionLabel>
        <DetailRow label="Resolved Pubkey Source" value={`${pkSource}${resolvedPk ? `: ${resolvedPk.slice(0, 16)}…` : ""}`} />
        <DetailRow
          label="tx.description"
          value={tx.description ? (tx.description.trim().startsWith("{") ? "(JSON)" : tx.description) : "(empty)"}
          wrap
        />
        {tx.invoice && (() => {
          try {
            const desc = decodeInvoice(tx.invoice)?.description;
            if (!desc) return <DetailRow label="invoice description" value="(empty)" />;
            return <DetailRow label="invoice description" value={desc.trim().startsWith("{") ? "(JSON)" : desc} wrap />;
          } catch { return <DetailRow label="invoice description" value="(decode error)" />; }
        })()}
        <DetailRow
          label="tx.metadata"
          value={tx.metadata ? JSON.stringify(tx.metadata, null, 2) : "(none)"}
          mono pre
        />

        {/* Zapped Note */}
        {zappedNoteId && (
          <>
            <SectionLabel>Zapped Note</SectionLabel>
            <ZappedNote noteId={zappedNoteId} relayHints={zapReqRelayUrls} profiles={profiles} onOpenProfile={onOpenProfile} onOpenThread={onOpenThread} />
          </>
        )}
      </div>
    </div>
  );
}
