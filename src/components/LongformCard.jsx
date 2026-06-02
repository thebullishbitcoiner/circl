import { useState } from "react";
import Avatar from "./Avatar.jsx";
import { Hi, Bi, Cl } from "./icons.jsx";
import { displayName, nip05OrNpub, relativeTime, parseArticle } from "../utils.js";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";

export default function LongformCard({ event, profiles, liked, bookmarked, likeCount, onLike, onBookmark, onOpen, onOpenProfile, delay }) {
  const art = parseArticle(event);
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);

  return (
    <>
    <div className="longform-card" style={{ animationDelay: `${delay}s`, zIndex: cardMenuOpen ? 1 : undefined }} onClick={() => onOpen(event)}>
      <div className="note-header">
        <div onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} style={{ cursor: "pointer", flexShrink: 0 }}>
          <Avatar pk={event.pubkey} profiles={profiles} size={36} />
        </div>
        <div className="note-meta">
          <span className="note-name" style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
            {displayName(event.pubkey, profiles)}
          </span>
          <span className="note-npub">{nip05OrNpub(event.pubkey, profiles)}</span>
          <span className="meta-dot" aria-hidden="true">·</span>
          <span className="note-time">{relativeTime(event.created_at)}</span>
        </div>
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
          <NoteContextMenu
            event={event}
            onClose={() => setCardMenuOpen(false)}
            onViewJson={() => setJsonOpen(true)}
          />
        )}
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
                  <button className={`action-btn ${bookmarked ? "saved" : ""}`} onClick={e => { e.stopPropagation(); onBookmark(event); }}><Bi f={bookmarked} /></button>
                </div>
              </div>
            </div>
          </div>
    </div>
    {jsonOpen && <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />}
    </>
  );
}
