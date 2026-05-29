import { useState } from "react";
import { createPortal } from "react-dom";

export default function NoteJsonModal({ event, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = e => {
    e.stopPropagation();
    navigator.clipboard?.writeText(JSON.stringify(event, null, 2)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return createPortal(
    <div className="overlay centered" onClick={e => e.stopPropagation()}>
      <div className="note-json-modal" onClick={e => e.stopPropagation()}>
        <div className="note-json-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="note-json-title">Event JSON</div>
            <button type="button" className="note-json-copy" onClick={copy} aria-label="Copy JSON">
              {copied ? "✓" : "⧉"}
            </button>
          </div>
          <button type="button" className="note-json-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="note-json-pre-wrap">
          <pre className="note-json-pre">{JSON.stringify(event, null, 2)}</pre>
        </div>
      </div>
    </div>,
    document.body
  );
}
