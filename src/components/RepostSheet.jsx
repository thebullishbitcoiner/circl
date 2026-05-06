import Overlay from "./Overlay.jsx";
import { Rpi } from "./icons.jsx";
import ComposeSheet from "./ComposeSheet.jsx";

export default function RepostSheet({ event, profiles, onQuoteRepost, onDismiss, publishEvent, onPrepend }) {
  const handleRepost = async () => {
    onDismiss?.();
    const kind6 = {
      kind: 6,
      content: JSON.stringify(event),
      tags: [["e", event.id, "", "mention"], ["p", event.pubkey]],
    };
    const published = await publishEvent?.(kind6);
    if (published) onPrepend?.(published);
  };

  return (
    <Overlay onDismiss={onDismiss}>
      <div className="action-sheet" onClick={e => e.stopPropagation()}>
        <div className="action-sheet-handle" />
        <button className="action-sheet-btn" onClick={handleRepost}>
          <div className="action-sheet-btn-icon"><Rpi s={18} /></div>
          <div>
            <div style={{ fontWeight: 500 }}>Repost</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>Instantly share to your followers</div>
          </div>
        </button>
        <button className="action-sheet-btn" onClick={() => onQuoteRepost?.()}>
          <div className="action-sheet-btn-icon">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>Quote repost</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>Add your own commentary</div>
          </div>
        </button>
        <button className="action-sheet-cancel" onClick={onDismiss}>Cancel</button>
      </div>
    </Overlay>
  );
}
