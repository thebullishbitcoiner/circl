import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import NoteActions from "./NoteActions.jsx";
import FocusedStatsRow from "./FocusedStatsRow.jsx";
import { Bk } from "./icons.jsx";
import { displayName, nip05OrNpub, relativeTime, isQuoteRepost, replyCount, buildParentChain, buildSelfReplyChain } from "../utils.js";

function ThreadNoteRow({
  event, variant = "normal", profiles, allEvents, onOpenProfile, onOpenThread,
  onOpenZaps, onOpenReactions, onOpenReposts,
  myPubkey, myProfile, onPublish, publishEvent, onPrepend, onBookmark, isBookmarked,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction, onRequestModal, onDismissModal,
  resolveEventById,
  focusRef, hasConnector = false,
  threadMenuId, setThreadMenuId, onShowThreadJson,
}) {
  const rCount    = replyCount(event.id, allEvents);
  const focused   = variant === "focused";
  const isParent  = variant === "parent";
  const isSelf    = variant === "self-reply";
  const isReply   = variant === "reply";
  const clickable = isParent || isReply || isSelf;

  const zaps      = getLocalZaps?.(event.id) ?? [];
  const reactions = getLocalReactions?.(event.id) ?? [];

  return (
    <div
      ref={focused ? focusRef : null}
      className={`thread-note${focused ? " focused" : ""}${isParent ? " parent" : ""}${isSelf ? " self-thread" : ""}${isReply ? " reply" : ""}${hasConnector ? " has-connector" : ""}`}
      onClick={clickable ? () => onOpenThread?.(event) : undefined}
    >
      <div className="note-inner">
        <div onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} style={{ cursor: "pointer", flexShrink: 0 }}>
          <Avatar pk={event.pubkey} profiles={profiles} size={focused ? 40 : 34} />
        </div>
        <div className="note-body">
          <button
            type="button"
            className="note-card-menu-btn"
            onClick={e => {
              e.stopPropagation();
              setThreadMenuId(id => (id === event.id ? null : event.id));
            }}
            aria-label="More options"
          >
            <span />
            <span />
            <span />
          </button>
          {threadMenuId === event.id && (
            <div className="note-card-menu" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className="note-card-menu-item"
                onClick={() => {
                  navigator.clipboard?.writeText(event.content || "").catch(() => {});
                  setThreadMenuId(null);
                }}
              >
                Copy Note Text
              </button>
              <button
                type="button"
                className="note-card-menu-item"
                onClick={() => {
                  navigator.clipboard?.writeText(event.id || "").catch(() => {});
                  setThreadMenuId(null);
                }}
              >
                Copy Note ID
              </button>
              <button
                type="button"
                className="note-card-menu-item"
                onClick={() => {
                  setThreadMenuId(null);
                  onShowThreadJson(event);
                }}
              >
                View JSON
              </button>
            </div>
          )}
          <div className="note-meta">
            <span className="note-name" style={{ cursor: "pointer", fontSize: focused ? 14 : 13 }}
              onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
              {displayName(event.pubkey, profiles)}
            </span>
            <span className="note-npub">{nip05OrNpub(event.pubkey, profiles)}</span>
            <span className="meta-dot" aria-hidden="true">·</span>
            <span className="note-time">{relativeTime(event.created_at)}</span>
          </div>
          {(() => {
            const isQuote   = isQuoteRepost(event);
            const quotedId  = isQuote ? event.tags.find(t => t[0] === "q")?.[1] : null;
            const quotedEv  = quotedId ? allEvents.find(e => e.id === quotedId) : null;
            const displayContent = isQuote
              ? event.content.replace(/\nnostr:\S+/g, "").replace(/nostr:\S+/g, "").trim()
              : event.content;
            return (
              <>
                {displayContent && (
                  <NoteContent content={displayContent} profiles={profiles} onOpenProfile={onOpenProfile}
                    allEvents={allEvents}
                    onOpenThread={onOpenThread}
                    resolveEventById={resolveEventById}
                    className="note-text" style={focused ? { fontSize: 16, lineHeight: 1.75 } : {}} />
                )}
                {isQuote && quotedEv && (
                  <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", background: "var(--surface)", marginTop: 6, cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); onOpenThread?.(quotedEv); }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      <Avatar pk={quotedEv.pubkey} profiles={profiles} size={20} />
                      <span style={{ fontSize: 12, fontWeight: 500 }} onClick={e => { e.stopPropagation(); onOpenProfile?.(quotedEv.pubkey); }}>
                        {displayName(quotedEv.pubkey, profiles)}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto" }}>{relativeTime(quotedEv.created_at)}</span>
                    </div>
                    <NoteContent content={quotedEv.content} profiles={profiles} onOpenProfile={onOpenProfile}
                      allEvents={allEvents}
                      onOpenThread={onOpenThread}
                      resolveEventById={resolveEventById}
                      className="note-text" style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }} />
                  </div>
                )}
              </>
            );
          })()}
          {focused && (
            <FocusedStatsRow eventId={event.id} rCount={rCount} allEvents={allEvents}
              zaps={zaps} reactions={reactions}
              onOpenZaps={onOpenZaps} onOpenReactions={onOpenReactions} onOpenReposts={onOpenReposts} />
          )}
          {(focused || isReply || isSelf) && (
            <NoteActions
              event={event} profiles={profiles}
              myPubkey={myPubkey} myProfile={myProfile} events={allEvents}
              onOpenThread={onOpenThread} onOpenZaps={onOpenZaps}
              onOpenReactions={onOpenReactions} onOpenReposts={onOpenReposts}
              onPublish={onPublish} publishEvent={publishEvent} onPrepend={onPrepend}
              onBookmark={onBookmark} isBookmarked={isBookmarked}
              getLocalZaps={getLocalZaps} addLocalZap={addLocalZap}
              getLocalReactions={getLocalReactions} setLocalReaction={setLocalReaction}
              onRequestModal={onRequestModal} onDismissModal={onDismissModal}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const Connector = ({ chain = false }) => (
  <div className="thread-connector">
    <div className={`thread-connector-line${chain ? " chain" : ""}`} />
  </div>
);

export default function ThreadView({
  focusedEvent, events, profiles, onBack, onOpenProfile, onOpenThread,
  onOpenZaps, onOpenReactions, onOpenReposts,
  myPubkey, myProfile, onPublish, publishEvent, onPrepend, onBookmark, isBookmarked,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction, onRequestModal, onDismissModal,
  resolveEventById,
}) {
  const containerRef = useRef(null);
  const focusRef     = useRef(null);
  const authorPk     = focusedEvent.pubkey;
  const [threadMenuId, setThreadMenuId]     = useState(null);
  const [threadJsonEvent, setThreadJsonEvent] = useState(null);
  const [threadJsonCopied, setThreadJsonCopied] = useState(false);

  const parents    = buildParentChain(focusedEvent, events);
  const selfChain  = buildSelfReplyChain(focusedEvent, events, authorPk);

  const chainIds = new Set([
    ...parents.map(e => e.id),
    focusedEvent.id,
    ...selfChain.map(e => e.id),
  ]);

  const otherReplies = events.filter(e =>
    e.kind === 1 &&
    !chainIds.has(e.id) &&
    !isQuoteRepost(e) &&
    e.tags.some(t =>
      t[0] === "e" && t[3] !== "mention" &&
      (t[1] === focusedEvent.id || selfChain.some(s => s.id === t[1]))
    )
  ).sort((a, b) => a.created_at - b.created_at);

  const rowProps = {
    profiles, allEvents: events,
    onOpenProfile, onOpenThread, onOpenZaps, onOpenReactions, onOpenReposts,
    myPubkey, myProfile, onPublish, publishEvent, onPrepend,
    onBookmark, isBookmarked, getLocalZaps, addLocalZap,
    getLocalReactions, setLocalReaction, onRequestModal, onDismissModal, resolveEventById,
    threadMenuId, setThreadMenuId, onShowThreadJson: setThreadJsonEvent,
  };

  useEffect(() => {
    setThreadMenuId(null);
    setThreadJsonEvent(null);
  }, [focusedEvent.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (focusRef.current && containerRef.current) {
        const c  = containerRef.current;
        const el = focusRef.current;
        c.scrollTop = el.offsetTop - (c.clientHeight - el.offsetHeight) / 2;
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [focusedEvent.id]);

  return (
    <div ref={containerRef} className="slide-panel-scroll">
      <div className="panel-bar">
        <button className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Thread</span>
      </div>

      {parents.map(e => (
        <div key={e.id}>
          <ThreadNoteRow event={e} variant="parent" hasConnector={true} {...rowProps} />
          <Connector chain={false} />
        </div>
      ))}

      <ThreadNoteRow event={focusedEvent} variant="focused" hasConnector={selfChain.length > 0} focusRef={focusRef} {...rowProps} />
      {selfChain.length > 0 && <Connector chain={true} />}

      {selfChain.map((e, i) => {
        const hasMore = i < selfChain.length - 1;
        return (
          <div key={e.id}>
            <ThreadNoteRow event={e} variant="self-reply" hasConnector={hasMore} {...rowProps} />
            {hasMore && <Connector chain={true} />}
          </div>
        );
      })}

      {otherReplies.length > 0 && (
        <>
          <div className="thread-replies-label">{otherReplies.length} {otherReplies.length === 1 ? "reply" : "replies"}</div>
          {otherReplies.map(e => (
            <ThreadNoteRow key={e.id} event={e} variant="reply" hasConnector={false} {...rowProps} />
          ))}
        </>
      )}

      {otherReplies.length === 0 && selfChain.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 32 }}>
          <div className="empty-state-sub">No replies yet</div>
        </div>
      )}

      {threadJsonEvent && createPortal(
        <div className="overlay centered profile-json-overlay" onClick={() => setThreadJsonEvent(null)}>
          <div className="note-json-modal" onClick={ev => ev.stopPropagation()}>
            <div className="note-json-header">
              <div className="note-json-title">Event JSON</div>
              <button type="button" className="note-json-close" onClick={() => setThreadJsonEvent(null)} aria-label="Close">×</button>
            </div>
            <div className="note-json-pre-wrap">
              <button
                type="button"
                className="note-json-copy"
                onClick={ev => {
                  ev.stopPropagation();
                  navigator.clipboard?.writeText(JSON.stringify(threadJsonEvent, null, 2)).catch(() => {});
                  setThreadJsonCopied(true);
                  setTimeout(() => setThreadJsonCopied(false), 1200);
                }}
                aria-label="Copy JSON"
              >
                {threadJsonCopied ? "✓" : "⧉"}
              </button>
              <pre className="note-json-pre">{JSON.stringify(threadJsonEvent, null, 2)}</pre>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
