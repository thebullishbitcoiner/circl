import { useState, useCallback } from "react";
import Avatar from "./Avatar.jsx";
import { Hi, Bi, Cl } from "./icons.jsx";
import { displayName, nip05OrNpub, relativeTime, parseArticle } from "../utils.js";

export default function LongformCard({ event, profiles, liked, bookmarked, likeCount, onLike, onBookmark, onOpen, onOpenProfile, delay }) {
  const art = parseArticle(event);
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  const copyToClipboard = useCallback(text => {
    navigator.clipboard?.writeText(text).catch(() => {});
  }, []);

  const copyNoteText = useCallback(() => {
    copyToClipboard(event.content || "");
    setCardMenuOpen(false);
  }, [event.content, copyToClipboard]);

  const copyNoteId = useCallback(() => {
    copyToClipboard(event.id || "");
    setCardMenuOpen(false);
  }, [event.id, copyToClipboard]);

  const copyJson = useCallback(() => {
    copyToClipboard(JSON.stringify(event, null, 2));
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 1200);
  }, [event, copyToClipboard]);

  return (
    <>
    <div className="longform-card" style={{ animationDelay: `${delay}s` }} onClick={() => onOpen(event)}>
      <div className="note-inner">
        <div onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} style={{ cursor: "pointer", flexShrink: 0 }}>
          <Avatar pk={event.pubkey} profiles={profiles} size={36} />
        </div>
        <div className="note-body">
          <button
            type="button"
            className="note-card-menu-btn"
            onClick={e => { e.stopPropagation(); setCardMenuOpen(v => !v); }}
            aria-label="More options"
          >
            <span />
            <span />
            <span />
          </button>
          {cardMenuOpen && (
            <div className="note-card-menu" onClick={e => e.stopPropagation()}>
              <button className="note-card-menu-item" onClick={copyNoteText}>Copy Note Text</button>
              <button className="note-card-menu-item" onClick={copyNoteId}>Copy Note ID</button>
              <button className="note-card-menu-item" onClick={() => { setCardMenuOpen(false); setJsonOpen(true); }}>View JSON</button>
            </div>
          )}
          <div className="note-meta">
            <span className="note-name" style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
              {displayName(event.pubkey, profiles)}
            </span>
            <span className="note-npub">{nip05OrNpub(event.pubkey, profiles)}</span>
            <span className="meta-dot" aria-hidden="true">·</span>
            <span className="note-time">{relativeTime(event.created_at)}</span>
          </div>
          <div className="lf-inner">
            {art.image ? (
              <img className="lf-image" src={art.image} alt={art.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            ) : (
              <div className="lf-placeholder">✦</div>
            )}
            <div className="lf-body">
              <div className="lf-title">{art.title}</div>
              <div className="lf-summary">{art.summary}</div>
              {art.hashtags?.length ? (
                <div className="lf-hashtags">
                  {art.hashtags.slice(0, 4).map(t => <span key={t}>#{t}</span>)}
                </div>
              ) : null}
              <div className="lf-footer">
                <span className="lf-readtime"><Cl />{art.readtime}</span>
                <div className="lf-actions">
                  <button className={`action-btn ${liked ? "liked" : ""}`} onClick={e => { e.stopPropagation(); onLike(event.id); }}><Hi f={liked} />{likeCount}</button>
                  <button className={`action-btn ${bookmarked ? "saved" : ""}`} onClick={e => { e.stopPropagation(); onBookmark(event.id); }}><Bi f={bookmarked} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    {jsonOpen && (
      <div className="overlay centered" onClick={() => setJsonOpen(false)}>
        <div className="note-json-modal" onClick={e => e.stopPropagation()}>
          <div className="note-json-header">
            <div className="note-json-title">Event JSON</div>
            <button type="button" className="note-json-close" onClick={() => setJsonOpen(false)} aria-label="Close">×</button>
          </div>
          <div className="note-json-pre-wrap">
            <button type="button" className="note-json-copy" onClick={e => { e.stopPropagation(); copyJson(); }} aria-label="Copy JSON">
              {jsonCopied ? "✓" : "⧉"}
            </button>
            <pre className="note-json-pre">{JSON.stringify(event, null, 2)}</pre>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
