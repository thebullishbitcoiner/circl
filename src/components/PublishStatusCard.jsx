import usePublishStatus, { PUBLISH_STATUS_AUTO_DISMISS_MS } from "../hooks/usePublishStatus.js";
import { publishStatusHeaderText, PublishStatusRows, PublishStatusProgress } from "./PublishStatusBody.jsx";

export default function PublishStatusCard() {
  const { session, dismiss } = usePublishStatus();
  if (!session) return null;

  return (
    <div className="panel-card">
      <div className="panel-title publish-status-title">
        <span>{publishStatusHeaderText(session)}</span>
        <button type="button" className="publish-status-close" onClick={dismiss} aria-label="Dismiss">×</button>
      </div>
      <PublishStatusRows relays={session.relays} />
      <PublishStatusProgress sessionId={session.id} durationMs={PUBLISH_STATUS_AUTO_DISMISS_MS} />
    </div>
  );
}
