import { avatarUrl, avatarInitial, fmtSats } from "../utils.js";

export default function ZapBadges({ zaps, eventId, profiles, onOpenProfile, onOpenZaps }) {
  if (!zaps?.length) return null;
  const [top, ...rest] = zaps;
  const visible   = rest.slice(0, 3);
  const totalRest = rest.length;

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
      <div style={{ display: "flex", marginBottom: rest.length ? 5 : 0 }}>
        <div className="zap-badge-top" onClick={() => onOpenProfile?.(top.zapper)}>
          <div className="zap-badge-top-av">
            {avatarUrl(top.zapper, profiles)
              ? <img src={avatarUrl(top.zapper, profiles)} alt="" onError={e => { e.target.style.display = "none"; }} />
              : avatarInitial(top.zapper, profiles)}
          </div>
          <div className="zap-badge-top-body">
            <div className="zap-badge-top-amt">
              {fmtSats(top.amount)}
              {top.comment && (
                <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 5, fontFamily: "'DM Sans',sans-serif", fontSize: 10.5 }}>
                  {top.comment}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      {rest.length > 0 && (
        <div className="zap-row">
          {visible.map((z, i) => <CompactBadge key={i} z={z} />)}
          {totalRest > 3 && (
            <button
              onClick={e => { e.stopPropagation(); onOpenZaps?.({ eventId, zaps }); }}
              style={{ padding: "3px 10px", borderRadius: 50, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>
              +{totalRest - 3} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
