import usePollData from "../hooks/usePollData.js";
import { fmtSatsVal } from "../utils.js";

function pct(count, total) {
  return total ? Math.round((count / total) * 100) : 0;
}

export default function PollPreview({ event }) {
  const { options, voteCounts, total, loading, isExpired, voterCount } = usePollData({ event, myPubkey: null });
  const isZapPoll = event.kind === 6969;

  if (!options.length) return null;

  return (
    <div className="poll-preview-wrap">
      {options.map(opt => {
        const count = voteCounts[opt.id] ?? 0;
        const p = pct(count, total);
        return (
          <div key={opt.id} className="poll-result-row">
            <div className="poll-bar-wrap">
              <div className="poll-bar-fill" style={{ "--pct": `${p}%` }} />
            </div>
            <div className="poll-result-label">
              <span className="poll-opt-text">
                {isZapPoll && <span className="poll-zap-icon">⚡</span>}
                {opt.label}
              </span>
              <span className="poll-opt-count">
                {isZapPoll ? `${fmtSatsVal(count)} sats` : count} · {p}%
              </span>
            </div>
          </div>
        );
      })}
      {!loading && (
        <div className="poll-footer">
          {voterCount} vote{voterCount !== 1 ? "s" : ""}
          {isExpired && " · Ended"}
        </div>
      )}
    </div>
  );
}
