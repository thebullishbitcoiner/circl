import { useState, memo } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import NoteActions from "./NoteActions.jsx";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import { displayName, nip05OrNpub, relativeTime } from "../utils.js";
import ZapGoalProgressBlock from "./ZapGoalProgressBlock.jsx";

function ZapGoalCard({
  event, profiles,
  myPubkey, myProfile,
  events = [],
  resolveEventById,
  onOpenProfile, onOpenGoal, onOpenThread, onOpenHashtag, onOpenZaps, onOpenReactions, onOpenReposts,
  onPublish, publishEvent, onPrepend,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  sendZap, defaultZapAmount = 21, defaultZapMsg = "", onZapFail,
  onRequestModal, onDismissModal,
  isBookmarked, onBookmark,
  delay = 0,
}) {
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen]         = useState(false);

  const image    = event.tags?.find(t => t[0] === "image")?.[1] || null;
  const closedAt = event.tags?.find(t => t[0] === "closed_at")?.[1];
  const isClosed = closedAt ? Math.floor(Date.now() / 1000) > Number(closedAt) : false;

  return (
    <>
      <div
        className="note-card"
        style={{ animationDelay: `${delay}s`, zIndex: cardMenuOpen ? 1 : undefined }}
        onClick={() => onOpenGoal ? onOpenGoal(event) : onOpenThread?.(event)}
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
            <NoteContextMenu event={event} onClose={() => setCardMenuOpen(false)} onViewJson={() => setJsonOpen(true)} />
          )}
        </div>

        {image && (
          <div className="zap-goal-image" onClick={e => e.stopPropagation()}>
            <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          </div>
        )}

        <div className="zap-goal-title-row">
          <NoteContent
            content={event.content}
            tags={event.tags}
            profiles={profiles}
            onOpenProfile={onOpenProfile}
            onOpenHashtag={onOpenHashtag}
            allEvents={events}
            onOpenThread={onOpenThread}
            resolveEventById={resolveEventById}
            allowEmbeds={false}
            className="note-text"
          />
          <span className="zap-goal-badge">⚡ Goal</span>
          {isClosed && <span className="zap-goal-badge zap-goal-badge-closed">Closed</span>}
        </div>

        <ZapGoalProgressBlock event={event} hideBadge />

        <NoteActions
          event={event}
          profiles={profiles}
          myPubkey={myPubkey}
          myProfile={myProfile}
          events={events}
          onOpenThread={onOpenThread}
          onOpenZaps={onOpenZaps}
          onOpenReactions={onOpenReactions}
          onOpenReposts={onOpenReposts}
          onPublish={onPublish}
          publishEvent={publishEvent}
          onPrepend={onPrepend}
          onBookmark={onBookmark}
          isBookmarked={isBookmarked}
          getLocalZaps={getLocalZaps}
          addLocalZap={addLocalZap}
          getLocalReactions={getLocalReactions}
          setLocalReaction={setLocalReaction}
          sendZap={sendZap}
          defaultZapAmount={defaultZapAmount}
          defaultZapMsg={defaultZapMsg}
          onZapFail={onZapFail}
          onRequestModal={onRequestModal}
          onDismissModal={onDismissModal}
        />
      </div>

      {jsonOpen && createPortal(
        <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />,
        document.body
      )}
    </>
  );
}

export default memo(ZapGoalCard);
