import useGoalProgress from "../hooks/useGoalProgress.js";

function fmtSatsFull(msats) {
  return Math.round((msats ?? 0) / 1000).toLocaleString("en-US").replace(/,/g, " ");
}

export default function ZapGoalProgressBlock({ event, hideBadge = false }) {
  const { raisedMsats, targetMsats, percentage, isClosed } = useGoalProgress(event);
  const summary = event.tags?.find(t => t[0] === "summary")?.[1] || null;

  return (
    <>
      {summary && <p className="zap-goal-summary">{summary}</p>}
      {!hideBadge && (
        <div className="zap-goal-badge-row">
          <span className="zap-goal-badge">⚡ Goal</span>
          {isClosed && <span className="zap-goal-badge zap-goal-badge-closed">Closed</span>}
        </div>
      )}
      <div className="zap-goal-progress" onClick={e => e.stopPropagation()}>
        <div className="zap-goal-bar-wrap">
          <div className="zap-goal-bar-fill" style={{ "--pct": `${percentage}%` }} />
        </div>
        <div className="zap-goal-stats">
          <span className="zap-goal-raised">
            <strong>{fmtSatsFull(raisedMsats)}</strong>
            {targetMsats > 0 && <> / {fmtSatsFull(targetMsats)} sats</>}
          </span>
          <span className="zap-goal-meta">{percentage}%</span>
        </div>
      </div>
    </>
  );
}
