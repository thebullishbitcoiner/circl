import { useState } from "react";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import NoteActions from "./NoteActions.jsx";
import { displayName, nip05OrNpub, relativeTime } from "../utils.js";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";

export default function NoteCard({
  event, profiles, liked, bookmarked, likeCount,
  replyCount: rCount = 0, repostCount: rpCount = 0,
  myPubkey, myProfile, onLike, onBookmark,
  onOpenProfile, onOpenThread, onOpenHashtag, onOpenZaps, onOpenReactions, onOpenReposts,
  events = [],
  resolveEventById,
  onPublish, publishEvent, onPrepend,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  delay,
  replyingToPubkey = null,
  sendZap, defaultZapAmount = 21, defaultZapMsg = "", onZapFail, onZapDebug,
}) {
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);


  return (
    <>
      <div
        className="note-card"
        style={{ animationDelay: `${delay}s` }}
        onClick={() => onOpenThread?.(event)}
      >
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
              <span /><span /><span />
            </button>
            {cardMenuOpen && (
              <NoteContextMenu
                event={event}
                onClose={() => setCardMenuOpen(false)}
                onViewJson={() => setJsonOpen(true)}
              />
            )}
            <div className="note-meta">
              <span className="note-name" style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
                {displayName(event.pubkey, profiles)}
              </span>
              <span className="note-npub">{nip05OrNpub(event.pubkey, profiles)}</span>
              <span className="meta-dot" aria-hidden="true">·</span>
              <span className="note-time">{relativeTime(event.created_at)}</span>
            </div>
            {replyingToPubkey && (
              <div
                className="ix-direction"
                style={{ marginBottom: 6, cursor: "pointer" }}
                onClick={e => { e.stopPropagation(); onOpenProfile?.(replyingToPubkey); }}
              >
                <span className="ix-dir-arrow">↩</span>
                replying to <span className="ix-mention" style={{ marginLeft: 3 }}>@{displayName(replyingToPubkey, profiles)}</span>
              </div>
            )}
            <NoteContent
              content={event.content}
              profiles={profiles}
              onOpenProfile={onOpenProfile}
              onOpenHashtag={onOpenHashtag}
              allEvents={events}
              onOpenThread={onOpenThread}
              resolveEventById={resolveEventById}
              collapsible
            />
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
              isBookmarked={() => bookmarked}
              getLocalZaps={getLocalZaps}
              addLocalZap={addLocalZap}
              getLocalReactions={getLocalReactions}
              setLocalReaction={setLocalReaction}
              sendZap={sendZap}
              defaultZapAmount={defaultZapAmount}
              defaultZapMsg={defaultZapMsg}
              onZapFail={onZapFail}
              onZapDebug={onZapDebug}
            />
          </div>
        </div>
      </div>

      {jsonOpen && <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />}
    </>
  );
}
