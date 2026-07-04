import { useState } from "react";
import Overlay from "./Overlay.jsx";
import { useDraftsContext } from "../contexts/DraftsContext.jsx";
import { relativeTime } from "../utils.js";

function draftLabel(id) {
  if (id === "new-note") return "New note";
  if (id.startsWith("reply-")) return "Reply";
  if (id.startsWith("quote-")) return "Quote";
  return "Draft";
}

export default function DraftsSheet({ onDismiss, onOpen, openingId }) {
  const { drafts, deleteDraft } = useDraftsContext();
  const entries = Object.entries(drafts).sort((a, b) => (b[1]._ts ?? 0) - (a[1]._ts ?? 0));

  return (
    <Overlay onDismiss={onDismiss} compose>
      <div className="compose-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div className="compose-sheet-bar">
          <button className="compose-sheet-cancel" onClick={onDismiss}>Close</button>
          <span className="compose-sheet-title">Drafts</span>
          <span style={{ width: 60 }} />
        </div>

        {entries.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "var(--text-faint)" }}>
            No saved drafts
          </div>
        ) : (
          <div style={{ overflowY: "auto", flex: 1 }}>
            {entries.map(([id, draft]) => {
              const label = draftLabel(id);
              const preview = draft.content?.trim() || (draft.media?.length ? "📎 Media" : "");
              const isOpening = openingId === id;

              return (
                <div
                  key={id}
                  style={{ borderBottom: "1px solid var(--border)", padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}
                >
                  <div
                    style={{ flex: 1, cursor: "pointer", minWidth: 0 }}
                    onClick={() => !isOpening && onOpen(id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 12%, transparent)", borderRadius: 6, padding: "1px 7px" }}>
                        {label}
                      </span>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--text-faint)" }}>
                        {draft._ts ? relativeTime(draft._ts) : ""}
                      </span>
                    </div>
                    {preview ? (
                      <p style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, color: isOpening ? "var(--text-faint)" : "var(--text)", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>
                        {isOpening ? "Opening…" : preview}
                      </p>
                    ) : (
                      <p style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-faint)", fontStyle: "italic" }}>Empty draft</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteDraft(id)}
                    style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 18, lineHeight: 1, padding: "2px 4px", borderRadius: 6 }}
                    title="Delete draft"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Overlay>
  );
}
