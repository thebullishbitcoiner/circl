import Overlay from "./Overlay.jsx";
import usePublishStatus, { PUBLISH_STATUS_AUTO_DISMISS_MS } from "../hooks/usePublishStatus.js";
import useIsMobile from "../hooks/useIsMobile.js";
import { publishStatusHeaderText, PublishStatusRows, PublishStatusProgress } from "./PublishStatusBody.jsx";

export default function PublishStatusModal() {
  const isMobile = useIsMobile();
  const { session, dismiss } = usePublishStatus();
  if (!isMobile || !session) return null;

  return (
    <Overlay onDismiss={dismiss} centered noClickOutside className="publish-status-overlay">
      <div className="publish-status-modal" onClick={e => e.stopPropagation()}>
        <div className="publish-status-header">
          <span>{publishStatusHeaderText(session)}</span>
          <button type="button" className="publish-status-close" onClick={dismiss} aria-label="Close">×</button>
        </div>
        <PublishStatusRows relays={session.relays} />
        <PublishStatusProgress sessionId={session.id} durationMs={PUBLISH_STATUS_AUTO_DISMISS_MS} />
      </div>
    </Overlay>
  );
}
