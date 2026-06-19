import { avatarUrl, avatarInitial, fmtSats } from "../utils.js";

export default function ZapBadges({ zaps, eventId, profiles, onOpenProfile, onOpenZaps }) {
  if (!zaps?.length) return null;

  const sorted = [...zaps].sort((a, b) => b.amount - a.amount);
  const hasUniqTop = sorted.length === 1 || sorted[0].amount > sorted[1].amount;
  const top     = hasUniqTop ? sorted[0] : null;
  const compact = hasUniqTop ? sorted.slice(1) : sorted;
  const visible   = compact.slice(0, top ? 3 : 4);
  const totalRest = compact.length;

  const CompactBadge = ({ z }) => (
    <div className="zap-badge" onClick={() => onOpenProfile?.(z.zapper)}>
      <div className="zap-badge-av">
        {avatarUrl(z.zapper, profiles)
          ? <img src={avatarUrl(z.zapper, profiles)} alt="" onError={e => { e.target.style.display = "none"; }} />
          : avatarInitial(z.zapper, profiles)}
      </div>
      <div className="zap-badge-amt">{fmtSats(z.amount)}</div>
    </div>
  );

  return (
    <div onClick={e => e.stopPropagation()} style={{ marginBottom: 8 }}>
      {top && (
        <div style={{ display: "flex", marginBottom: compact.length ? 5 : 0 }}>
          <div className="zap-badge-top" onClick={() => onOpenProfile?.(top.zapper)}>
            <div className="zap-badge-top-av">
              {avatarUrl(top.zapper, profiles)
                ? <img src={avatarUrl(top.zapper, profiles)} alt="" onError={e => { e.target.style.display = "none"; }} />
                : avatarInitial(top.zapper, profiles)}
            </div>
            <div className="zap-badge-top-body">
              <div className="zap-badge-top-amt">{fmtSats(top.amount)}</div>
              {top.comment && <div className="zap-badge-top-comment">"{top.comment}"</div>}
            </div>
          </div>
        </div>
      )}
      {compact.length > 0 && (
        <div className="zap-row">
          {visible.map((z, i) => <CompactBadge key={i} z={z} />)}
          {totalRest > (top ? 3 : 4) && (
            <button
              onClick={e => { e.stopPropagation(); onOpenZaps?.({ eventId, zaps }); }}
              style={{ padding: "3px 10px", borderRadius: 50, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>
              +{totalRest - (top ? 3 : 4)} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
