import { useCallback } from "react";
import Avatar from "./Avatar.jsx";
import { displayName, relativeTime } from "../utils.js";
import useWalletData from "../hooks/useWalletData.js";

function parseZapRequest(tx) {
  try {
    if (tx.description?.trim().startsWith("{")) return JSON.parse(tx.description);
  } catch {}
  return null;
}

function nostrPubkeyFromTx(tx) {
  const zr = parseZapRequest(tx);
  if (tx.type === "outgoing") {
    const pTag = zr?.tags?.find(t => t[0] === "p")?.[1];
    return pTag ?? tx.metadata?.nostr?.pubkey ?? null;
  }
  return tx.metadata?.nostr?.pubkey ?? zr?.pubkey ?? null;
}

function txComment(tx) {
  if (tx.metadata?.comment?.trim()) return tx.metadata.comment.trim();
  const zr = parseZapRequest(tx);
  return zr?.content?.trim() ?? "";
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
  if (sats >= 1_000_000) return `${prefix}${(sats / 1_000_000).toFixed(1)}M`;
  if (sats >= 1_000)     return `${prefix}${(sats / 1_000).toFixed(sats >= 10_000 ? 0 : 1)}k`;
  return `${prefix}${sats}`;
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

export default function WalletPage({ wallet, profiles, onOpenProfile, onOpenTransaction }) {
  const { balance, transactions, loading, error, refresh } = useWalletData(wallet);

  const handleRefresh = useCallback(() => { if (!loading) refresh(); }, [loading, refresh]);

  if (!wallet?.nwc_uri) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No wallet connected</div>
        <div className="empty-state-sub">Connect a wallet in Settings to see your balance and transaction history</div>
      </div>
    );
  }

  const settled = transactions.filter(tx => tx.state === "settled");

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* Balance card */}
      <div style={{ margin: "16px 16px 4px", padding: "20px 20px 18px", background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
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
          <div style={{ fontSize: 14, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif" }}>No transactions yet</div>
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
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", marginTop: 1, display: "flex", gap: 4, alignItems: "center" }}>
                    <span>{relativeTime(ts)}</span>
                    {comment && <><span>·</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{comment}</span></>}
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", color: isIncoming ? "#4CAF50" : "var(--text)" }}>
                    {amountStr}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", marginTop: 1 }}>sats</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
