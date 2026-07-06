import { useState } from "react";
import Avatar from "./Avatar.jsx";
import { Hi, Bi } from "./icons.jsx";
import { displayName, nip05OrNpub, relativeTime, parseStreamEvent } from "../utils.js";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";

function StatusBadge({ status }) {
  return (
    <span className={`stream-status-badge stream-status-${status}`}>
      {status === "live" && <span className="stream-live-dot" />}
      {status.toUpperCase()}
    </span>
  );
}

export default function StreamCard({ event, profiles, liked, bookmarked, likeCount, onLike, onBookmark, onOpen, onOpenProfile, delay }) {
  const stream = parseStreamEvent(event);
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);

  const hostPk = stream.host?.pubkey ?? event.pubkey;

  return (
    <>
    <div className="calendar-card stream-card" style={{ animationDelay: `${delay}s`, zIndex: cardMenuOpen ? 1 : undefined }} onClick={() => onOpen(event)}>
      <div className="note-header">
        <div onClick={e => { e.stopPropagation(); onOpenProfile?.(hostPk); }} style={{ cursor: "pointer", flexShrink: 0 }}>
          <Avatar pk={hostPk} profiles={profiles} size={36} />
        </div>
        <div className="note-meta">
          <div className="note-meta-top">
            <span className="note-name" style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(hostPk); }}>
              {displayName(hostPk, profiles)}
            </span>
            <span className="meta-dot" aria-hidden="true">·</span>
            <span className="note-time">{relativeTime(event.created_at)}</span>
          </div>
          <span className="note-npub">{nip05OrNpub(hostPk, profiles)}</span>
        </div>
        <button
          type="button"
          className="note-card-menu-btn"
          onClick={e => { e.stopPropagation(); setCardMenuOpen(v => !v); }}
          aria-label="More options"
        >
          <span /><span /><span />
        </button>
        {cardMenuOpen && (
          <NoteContextMenu
            event={event}
            onClose={() => setCardMenuOpen(false)}
            onViewJson={() => setJsonOpen(true)}
          />
        )}
      </div>

      <div className="cal-inner">
            {stream.image && (
              <img className="cal-cover-image" src={stream.image} alt={stream.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            )}
            <div className="cal-body">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <StatusBadge status={stream.status} />
                {stream.status === "live" && stream.viewers != null && (
                  <span className="stream-viewer-count">{stream.viewers} watching</span>
                )}
              </div>
              <div className="cal-title">{stream.title || "Untitled Stream"}</div>
              {stream.summary && (
                <div className="cal-summary">{stream.summary.slice(0, 120)}{stream.summary.length > 120 ? "…" : ""}</div>
              )}
              {stream.hashtags?.length ? (
                <div className="lf-hashtags">
                  {stream.hashtags.slice(0, 4).map(t => <span key={t}>#{t}</span>)}
                </div>
              ) : null}
              <div className="cal-footer">
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
