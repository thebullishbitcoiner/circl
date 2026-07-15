import { useState, useEffect } from "react";
import { displayName, parseHighlight, parseArticle } from "../utils.js";
import { pool } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";

function SourceChip({ sourceTag, sourceRef, sourceEvent }) {
  if (sourceTag === "r") {
    let hostname = sourceRef;
    try { hostname = new URL(sourceRef).hostname; } catch {}
    return (
      <a
        className="highlight-source-chip"
        href={sourceRef}
        target="_blank"
        rel="noreferrer"
        onClick={e => e.stopPropagation()}
      >
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        {hostname}
      </a>
    );
  }
  return null;
}

export default function HighlightInlineCard({ event, profiles, onOpenThread, onOpenArticle, resolveEventById }) {
  const [sourceEvent, setSourceEvent] = useState(null);
  const { text, sourceTag, sourceRef, authorPubkey, comment } = parseHighlight(event);
  const isNoteSource = sourceEvent?.kind === 1 || (sourceTag === "e" && sourceEvent && sourceEvent.kind !== 30023);
  const isArticleSource = sourceEvent?.kind === 30023;

  useEffect(() => {
    if (!sourceRef || sourceTag === "r") return;
    let cancelled = false;
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;

    if (sourceTag === "e") {
      resolveEventById?.(sourceRef).then(ev => {
        if (!cancelled && ev?.id) setSourceEvent(ev);
      }).catch(() => {});
    } else if (sourceTag === "a") {
      const parts = sourceRef.split(":");
      if (parts.length >= 3) {
        const [kindStr, apubkey, d] = parts;
        const sub = pool.request(relayUrls, [{ kinds: [Number(kindStr)], authors: [apubkey], "#d": [d], limit: 1 }]).subscribe({
          next: ev => { if (!cancelled) { setSourceEvent(ev); sub.unsubscribe(); } },
        });
        setTimeout(() => sub.unsubscribe(), 5000);
      }
    }
    return () => { cancelled = true; };
  }, [sourceRef, sourceTag, resolveEventById]);

  return (
    <div style={{ marginBottom: 6 }}>
      {comment && (
        <div className="highlight-comment">{comment}</div>
      )}

      <blockquote
        className="highlight-blockquote"
        style={{ cursor: (isNoteSource || isArticleSource) ? "pointer" : "default" }}
        onClick={e => {
          e.stopPropagation();
          if (isNoteSource && sourceEvent) onOpenThread?.(sourceEvent);
          else if (isArticleSource && sourceEvent) onOpenArticle?.(sourceEvent);
        }}
      >
        {text}
        {(authorPubkey || sourceEvent?.pubkey) && (
          <span className="highlight-attribution">
            — {displayName(authorPubkey || sourceEvent.pubkey, profiles)}
          </span>
        )}
      </blockquote>

      {!isNoteSource && (
        <div className="highlight-meta" onClick={e => e.stopPropagation()}>
          <span className="highlight-from-label">from</span>
          {isArticleSource
            ? <em style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{parseArticle(sourceEvent).title || "Article"}</em>
            : <SourceChip sourceTag={sourceTag} sourceRef={sourceRef} sourceEvent={sourceEvent} />
          }
        </div>
      )}
    </div>
  );
}
