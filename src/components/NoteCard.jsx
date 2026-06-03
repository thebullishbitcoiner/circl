import { useState, useEffect, useRef, memo, useCallback } from "react";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import NoteActions from "./NoteActions.jsx";
import PollInline from "./PollInline.jsx";
import CalendarInlineCard from "./CalendarInlineCard.jsx";
import ZapGoalProgressBlock from "./ZapGoalProgressBlock.jsx";
import { displayName, nip05OrNpub, relativeTime } from "../utils.js";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import HighlightPopover from "./HighlightPopover.jsx";
import HighlightSheet from "./HighlightSheet.jsx";

function NoteCard({
  event, profiles, liked, bookmarked, likeCount,
  replyCount: rCount = 0, repostCount: rpCount = 0,
  myPubkey, myProfile, onLike, onBookmark,
  onOpenProfile, onOpenThread, onOpenHashtag, onOpenZaps, onOpenReactions, onOpenReposts,
  events = [],
  resolveEventById,
  onPublish, publishEvent, onPrepend,
  publishHighlight,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  delay,
  replyingToPubkey = null,
  sendZap, defaultZapAmount = 21, defaultZapMsg = "", onZapFail,
  onOpenPollVotes,
}) {
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [highlightDraft, setHighlightDraft] = useState(null);
  const contentRef = useRef(null);
  const isBookmarkedFn = useCallback(() => bookmarked, [bookmarked]);

  const qId = event.tags?.find(t => t[0] === "q")?.[1] ?? null;

  const classifyQuoted = ev => {
    if (!ev) return null;
    if (ev.kind === 1068 || ev.kind === 6969) return "poll";
    if (ev.kind === 9041) return "goal";
    if (ev.kind === 31922 || ev.kind === 31923) return "calendar";
    return null;
  };

  const [quotedSpecialEvent, setQuotedSpecialEvent] = useState(() => {
    const ev = qId ? events.find(e => e.id === qId) : null;
    return classifyQuoted(ev) ? ev : null;
  });
  const specialFetchFired = useRef(false);

  // Keep as aliases for clarity in render
  const quotedPollEvent     = quotedSpecialEvent && (quotedSpecialEvent.kind === 1068 || quotedSpecialEvent.kind === 6969) ? quotedSpecialEvent : null;
  const quotedGoalEvent     = quotedSpecialEvent?.kind === 9041 ? quotedSpecialEvent : null;
  const quotedCalendarEvent = (quotedSpecialEvent?.kind === 31922 || quotedSpecialEvent?.kind === 31923) ? quotedSpecialEvent : null;

  useEffect(() => {
    if (!qId || quotedSpecialEvent) return;
    const fromPool = events.find(e => e.id === qId);
    if (classifyQuoted(fromPool)) { setQuotedSpecialEvent(fromPool); return; }
    if (specialFetchFired.current || !resolveEventById) return;
    specialFetchFired.current = true;
    resolveEventById(qId).then(ev => {
      if (classifyQuoted(ev)) setQuotedSpecialEvent(ev);
    });
  }, [qId, events, resolveEventById]);


  return (
    <>
      <div
        className="note-card"
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
            <div ref={contentRef}>
            {publishHighlight && (
              <HighlightPopover
                sourceEvent={event}
                containerRef={contentRef}
                onHighlight={draft => setHighlightDraft(draft)}
              />
            )}
            <NoteContent
              content={quotedSpecialEvent ? event.content.replace(/nostr:\S+/g, "").trim() : event.content}
              tags={event.tags}
              profiles={profiles}
              onOpenProfile={onOpenProfile}
              onOpenHashtag={onOpenHashtag}
              allEvents={events}
              onOpenThread={onOpenThread}
              resolveEventById={resolveEventById}
              allowEmbeds={!quotedSpecialEvent}
              collapsible
            />
            </div>
            {quotedPollEvent && (
              <PollInline
                event={quotedPollEvent}
                myPubkey={myPubkey}
                sendZap={sendZap}
                defaultZapAmount={defaultZapAmount}
                defaultZapMsg={defaultZapMsg}
                onZapFail={onZapFail}
                profiles={profiles}
                publishEvent={publishEvent}
                onOpenVotes={onOpenPollVotes}
              />
            )}
            {quotedGoalEvent && (
              <div className="note-embed" onClick={e => { e.stopPropagation(); onOpenThread?.(quotedGoalEvent); }}>
                <div className="note-embed-head">
                  <Avatar pk={quotedGoalEvent.pubkey} profiles={profiles} size={20} />
                  <span className="note-embed-name" onClick={e => { e.stopPropagation(); onOpenProfile?.(quotedGoalEvent.pubkey); }}>{displayName(quotedGoalEvent.pubkey, profiles)}</span>
                </div>
                <div className="zap-goal-title-row" style={{ marginBottom: 4 }}>
                  <NoteContent content={quotedGoalEvent.content} tags={quotedGoalEvent.tags} profiles={profiles} allowEmbeds={false} className="note-text" />
                  <span className="zap-goal-badge">⚡ Goal</span>
                </div>
                <ZapGoalProgressBlock event={quotedGoalEvent} hideBadge />
              </div>
            )}
            {quotedCalendarEvent && (
              <CalendarInlineCard event={quotedCalendarEvent} onOpen={onOpenThread} />
            )}
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
              isBookmarked={isBookmarkedFn}
              getLocalZaps={getLocalZaps}
              addLocalZap={addLocalZap}
              getLocalReactions={getLocalReactions}
              setLocalReaction={setLocalReaction}
              sendZap={sendZap}
              defaultZapAmount={defaultZapAmount}
              defaultZapMsg={defaultZapMsg}
              onZapFail={onZapFail}
            />
      </div>

      {jsonOpen && <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />}
      {highlightDraft && (
        <HighlightSheet
          text={highlightDraft.text}
          context={highlightDraft.context}
          sourceEvent={highlightDraft.sourceEvent}
          publishHighlight={publishHighlight}
          onPrepend={onPrepend}
          onDismiss={() => setHighlightDraft(null)}
        />
      )}
    </>
  );
}

export default memo(NoteCard);
