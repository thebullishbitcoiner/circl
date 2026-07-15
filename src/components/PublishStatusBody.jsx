const fmtUrl = url => url.replace(/^wss?:\/\//, "").replace(/\/$/, "");

export function publishStatusHeaderText(session) {
  if (session.relays.some(r => r.status === "pending")) return "Publishing note…";
  const failed = session.relays.filter(r => r.status === "failed").length;
  if (failed > 0) return `Published to ${session.relays.length - failed}/${session.relays.length} relays`;
  return "Published";
}

export function PublishStatusRows({ relays }) {
  return relays.map(r => (
    <div className="publish-status-relay-row" key={r.url}>
      <span className="publish-status-relay-url">{fmtUrl(r.url)}</span>
      {r.status === "pending" && <span className="publish-status-icon publish-status-icon-pending" aria-label="Pending" />}
      {r.status === "ok" && <span className="publish-status-icon publish-status-icon-ok" aria-label="Confirmed">✓</span>}
      {r.status === "failed" && (
        <span className="publish-status-icon publish-status-icon-failed" title={r.message || "Failed"} aria-label="Failed">✕</span>
      )}
    </div>
  ));
}

// Keyed by sessionId so the CSS countdown animation restarts on every new
// publish instead of continuing from a previous session's progress.
export function PublishStatusProgress({ sessionId, durationMs }) {
  return (
    <div className="publish-status-progress">
      <div key={sessionId} className="publish-status-progress-bar" style={{ animationDuration: `${durationMs}ms` }} />
    </div>
  );
}
