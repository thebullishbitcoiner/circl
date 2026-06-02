import { useState, useEffect, memo } from "react";
import Avatar from "./Avatar.jsx";
import NoteActions from "./NoteActions.jsx";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import { displayName, nip05OrNpub, relativeTime, parseHighlight, parseArticle } from "../utils.js";
import { pool } from "../nostr.js";
import { RELAYS } from "../constants.js";

function SourceChip({ sourceTag, sourceRef, sourceEvent, onOpenThread, onOpenArticle }) {
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

  if (sourceEvent) {
    if (sourceEvent.kind === 30023) {
      const art = parseArticle(sourceEvent);
      return (
        <button
          type="button"
          className="highlight-source-chip"
          onClick={e => { e.stopPropagation(); onOpenArticle?.(sourceEvent); }}
        >
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          {art.title}
        </button>
      );
    }
    return (
      <button
        type="button"
        className="highlight-source-chip"
        onClick={e => { e.stopPropagation(); onOpenThread?.(sourceEvent); }}
      >
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Note
      </button>
    );
  }

  return (
    <span className="highlight-source-chip highlight-source-unknown">
      Nostr
    </span>
  );
}

function HighlightCard({
  event, profiles,
  liked, likeCount,
  myPubkey, myProfile,
  onLike, onBookmark, bookmarked, isBookmarked,
  onOpenProfile, onOpenThread, onOpenArticle, onOpenHashtag,
  onOpenZaps, onOpenReactions, onOpenReposts,
  onPublish, publishEvent, onPrepend,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  onRequestModal, onDismissModal,
  sendZap, defaultZapAmount = 21, defaultZapMsg = "", onZapFail,
  resolveEventById,
  delay = 0,
}) {
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [sourceEvent, setSourceEvent] = useState(null);

  const { text, sourceTag, sourceRef, authorPubkey, comment } = parseHighlight(event);

  useEffect(() => {
    if (!sourceRef || sourceTag === "r") return;
    let cancelled = false;
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;

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
    <>
      <div
        className="note-card highlight-card"
        style={{ animationDelay: `${delay}s`, zIndex: cardMenuOpen ? 1 : undefined }}
        onClick={() => onOpenThread?.(event)}
      >
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

        {comment && (
          <div className="highlight-comment">{comment}</div>
        )}

        <blockquote className="highlight-blockquote" onClick={e => e.stopPropagation()}>
          {text}
          {(authorPubkey || sourceEvent?.pubkey) && (
            <span
              className="highlight-attribution"
              onClick={e => { e.stopPropagation(); onOpenProfile?.(authorPubkey || sourceEvent.pubkey); }}
            >
              — {displayName(authorPubkey || sourceEvent.pubkey, profiles)}
            </span>
          )}
        </blockquote>

        <div className="highlight-meta" onClick={e => e.stopPropagation()}>
          <span className="highlight-from-label">from</span>
          <SourceChip
            sourceTag={sourceTag}
            sourceRef={sourceRef}
            sourceEvent={sourceEvent}
            onOpenThread={onOpenThread}
            onOpenArticle={onOpenArticle}
          />
        </div>

        <NoteActions
          event={event}
          profiles={profiles}
          myPubkey={myPubkey}
          myProfile={myProfile}
          events={[]}
          onOpenThread={onOpenThread}
          onOpenZaps={onOpenZaps}
          onOpenReactions={onOpenReactions}
          onOpenReposts={onOpenReposts}
          onPublish={onPublish}
          publishEvent={publishEvent}
          onPrepend={onPrepend}
          onBookmark={onBookmark}
          isBookmarked={() => bookmarked}
          getLocalZaps={getLocalZaps}
          addLocalZap={addLocalZap}
          getLocalReactions={getLocalReactions}
          setLocalReaction={setLocalReaction}
          onRequestModal={onRequestModal}
          onDismissModal={onDismissModal}
          sendZap={sendZap}
          defaultZapAmount={defaultZapAmount}
          defaultZapMsg={defaultZapMsg}
          onZapFail={onZapFail}
        />
      </div>

      {jsonOpen && <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />}
    </>
  );
}

export default memo(HighlightCard);
