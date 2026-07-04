import { useState } from "react";
import { useDraftsContext } from "../contexts/DraftsContext.jsx";
import { relativeTime } from "../utils.js";

function draftLabel(id) {
  if (id === "new-note") return "New note";
  if (id.startsWith("reply-")) return "Reply";
  if (id.startsWith("quote-")) return "Quote";
  return "Draft";
}

export default function DraftsPage({ onOpen, openingId }) {
  const { drafts, deleteDraft } = useDraftsContext();
  const entries = Object.entries(drafts).sort((a, b) => (b[1]._ts ?? 0) - (a[1]._ts ?? 0));

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <span className="feed-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Drafts
          {entries.length > 0 && (
            <span style={{ background: "var(--primary)", color: "white", borderRadius: 50, fontSize: 11, fontWeight: 500, padding: "1px 8px", fontFamily: "'DM Sans',sans-serif" }}>
              {entries.length}
            </span>
          )}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No drafts</div>
          <div className="empty-state-sub">Cancelled notes are saved here automatically</div>
        </div>
      ) : (
        <div>
          {entries.map(([id, draft]) => {
            const label = draftLabel(id);
            const preview = draft.content?.trim() || (draft.media?.length ? "📎 Media" : "");
            const isOpening = openingId === id;

            return (
              <div
                key={id}
                style={{
                  borderBottom: "1px solid var(--border)",
                  padding: "14px 16px",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  cursor: isOpening ? "default" : "pointer",
                }}
                onClick={() => !isOpening && onOpen(id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--primary)",
                      background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                      borderRadius: 6,
                      padding: "1px 7px",
                    }}>
                      {label}
                    </span>
                    {draft._ts && (
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--text-faint)" }}>
                        {relativeTime(draft._ts)}
                      </span>
                    )}
                  </div>
                  {isOpening ? (
                    <p style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, color: "var(--text-faint)", fontStyle: "italic" }}>Opening…</p>
                  ) : preview ? (
                    <p style={{
                      margin: 0,
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 13.5,
                      color: "var(--text)",
                      lineHeight: 1.45,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      wordBreak: "break-word",
                    }}>
                      {preview}
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-faint)", fontStyle: "italic" }}>Empty draft</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); deleteDraft(id); }}
                  style={{
                    flexShrink: 0,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-faint)",
                    fontSize: 18,
                    lineHeight: 1,
                    padding: "2px 4px",
                    borderRadius: 6,
                  }}
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
  );
}
