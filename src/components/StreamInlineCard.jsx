import { parseStreamEvent } from "../utils.js";

function StatusBadge({ status }) {
  return (
    <span className={`stream-status-badge stream-status-${status}`}>
      {status === "live" && <span className="stream-live-dot" />}
      {status.toUpperCase()}
    </span>
  );
}

export default function StreamInlineCard({ event, onOpen }) {
  const stream = parseStreamEvent(event);
  return (
    <div className="cal-inner" style={{ marginBottom: 6 }} onClick={e => { e.stopPropagation(); onOpen?.(event); }}>
      {stream.image && (
        <img className="cal-cover-image" src={stream.image} alt={stream.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      )}
      <div className="cal-body">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <StatusBadge status={stream.status} />
          {stream.status === "live" && stream.viewers != null && (
            <span className="stream-viewer-count">{stream.viewers} watching</span>
          )}
        </div>
        <div className="cal-title">{stream.title || "Untitled Stream"}</div>
        {stream.summary && (
          <div className="cal-summary">{stream.summary.slice(0, 120)}{stream.summary.length > 120 ? "…" : ""}</div>
        )}
        {stream.hashtags?.length ? (
          <div className="lf-hashtags">
            {stream.hashtags.slice(0, 4).map(t => <span key={t}>#{t}</span>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
