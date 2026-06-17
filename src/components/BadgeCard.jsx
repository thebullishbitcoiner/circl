import { memo } from "react";

function BadgeCard({ awardEvent, defEvent, onClick, onAccept, delay = 0 }) {
  const name        = defEvent?.tags?.find(t => t[0] === "name")?.[1]        || "";
  const description = defEvent?.tags?.find(t => t[0] === "description")?.[1] || "";
  const image       = defEvent?.tags?.find(t => t[0] === "image")?.[1]       || null;

  return (
    <div
      className="listing-tile"
      style={{ animationDelay: `${delay}s`, cursor: onClick ? "pointer" : "default", opacity: onAccept ? 0.6 : 1 }}
      onClick={() => onClick?.(awardEvent)}
    >
      <div className="listing-tile-image">
        {image
          ? <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          : <div className="listing-tile-placeholder">◈</div>
        }
        {onAccept && (
          <button
            type="button"
            className="listing-tile-badge"
            style={{ cursor: "pointer", background: "var(--primary)", color: "#fff", border: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600 }}
            onClick={e => { e.stopPropagation(); onAccept(); }}
          >
            Accept
          </button>
        )}
      </div>
      <div className="listing-tile-body">
        {name        && <div className="listing-tile-title">{name}</div>}
        {description && <div className="listing-tile-summary">{description}</div>}
      </div>
    </div>
  );
}

export default memo(BadgeCard);
