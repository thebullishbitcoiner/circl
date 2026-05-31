import { useState } from "react";
import Overlay from "./Overlay.jsx";

export default function HighlightSheet({ text, context, sourceEvent, onDismiss, publishHighlight, onPrepend }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const handlePublish = async () => {
    if (busy) return;
    setBusy(true);
    const ev = await publishHighlight({ text, context, sourceEvent, comment });
    setBusy(false);
    onDismiss?.();
    if (ev) onPrepend?.(ev);
  };

  return (
    <Overlay onDismiss={onDismiss}>
      <div className="action-sheet highlight-sheet" onClick={e => e.stopPropagation()}>
        <div className="action-sheet-handle" />
        <div className="highlight-sheet-title">New Highlight</div>
        <blockquote className="highlight-blockquote highlight-sheet-preview">{text}</blockquote>
        <textarea
          className="highlight-sheet-comment"
          placeholder="Add a comment… (optional)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          maxLength={500}
        />
        <button
          type="button"
          className="action-sheet-btn highlight-sheet-submit"
          onClick={handlePublish}
          disabled={busy}
        >
          {busy ? "Publishing…" : "✦ Highlight"}
        </button>
        <button type="button" className="action-sheet-cancel" onClick={onDismiss}>Cancel</button>
      </div>
    </Overlay>
  );
}
