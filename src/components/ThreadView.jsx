import { useRef, useEffect, useState, useMemo } from "react";
import { useNavigation } from "../context/NavigationContext.jsx";
import MutedNoteGate from "./MutedNoteGate.jsx";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import NoteActions from "./NoteActions.jsx";
import FocusedStatsRow from "./FocusedStatsRow.jsx";
import HighlightPopover from "./HighlightPopover.jsx";
import HighlightSheet from "./HighlightSheet.jsx";
import { Bk } from "./icons.jsx";
import { displayName, nip05OrNpub, relativeTime, isQuoteRepost, replyCount, buildParentChain, buildSelfReplyChain, directReplyParentId, parseBolt11Msats, zapperPubkeyFromKind9735, zapCommentFromKind9735 } from "../utils.js";
import useProfiles from "../hooks/useProfiles.js";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";
import PollInline from "./PollInline.jsx";
import ZapGoalProgressBlock from "./ZapGoalProgressBlock.jsx";
import CalendarInlineCard from "./CalendarInlineCard.jsx";

function ThreadNoteRow({
  event, variant = "normal", profiles, allEvents, onOpenProfile, onOpenThread, onOpenHashtag,
  onOpenZaps, onOpenReactions, onOpenReposts,
  myPubkey, myProfile, onPublish, publishEvent, onPrepend, onBookmark, isBookmarked,
  publishHighlight,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction, onRequestModal, onDismissModal,
  sendZap, defaultZapAmount, defaultZapMsg, onZapFail,
  resolveEventById, onOpenPollVotes,
  focusRef, hasConnector = false,
  threadMenuId, setThreadMenuId, onShowThreadJson,
  customEmojis,
}) {
  const { onOpenGoal, onOpenPoll, onOpenCalendarEvent } = useNavigation();
  const rCount    = replyCount(event.id, allEvents);
  const [highlightDraft, setHighlightDraft] = useState(null);
  const contentRef = useRef(null);
  const focused   = variant === "focused";
  const isParent  = variant === "parent";
  const isSelf    = variant === "self-reply";
  const isReply   = variant === "reply";
  const clickable = isParent || isReply || isSelf;

  const zaps      = getLocalZaps?.(event.id) ?? [];
  const reactions = getLocalReactions?.(event.id) ?? [];

  return (
    <>
    <div
      ref={focused ? focusRef : null}
      className={`thread-note${focused ? " focused" : ""}${isParent ? " parent" : ""}${isSelf ? " self-thread" : ""}${isReply ? " reply" : ""}${hasConnector ? " has-connector" : ""}`}
      style={threadMenuId === event.id ? { zIndex: 1 } : undefined}
      onClick={clickable ? () => onOpenThread?.(event) : undefined}
    >
      <div className="note-header">
        <div onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} style={{ cursor: "pointer", flexShrink: 0 }}>
          <Avatar pk={event.pubkey} profiles={profiles} size={focused ? 40 : 34} />
        </div>
        <div className="note-meta">
          <div className="note-meta-top">
            <span className="note-name" style={{ cursor: "pointer", fontSize: focused ? 14 : 13 }}
              onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
              {displayName(event.pubkey, profiles)}
            </span>
            <span className="meta-dot" aria-hidden="true">·</span>
            <span className="note-time">{relativeTime(event.created_at)}</span>
          </div>
          <span className="note-npub">{nip05OrNpub(event.pubkey, profiles)}</span>
        </div>
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
          <NoteContextMenu
            event={event}
            onClose={() => setThreadMenuId(null)}
            onViewJson={onShowThreadJson}
          />
        )}
      </div>
      <div ref={contentRef}>
          {publishHighlight && (
            <HighlightPopover
              sourceEvent={event}
              containerRef={contentRef}
              onHighlight={draft => setHighlightDraft(draft)}
            />
          )}
          {(() => {
            const isGoal    = event.kind === 9041;
            const isPoll    = event.kind === 1068 || event.kind === 6969;
            const isQuote   = isQuoteRepost(event);
            const quotedId  = isQuote ? event.tags.find(t => t[0] === "q")?.[1] : null;
            const quotedEv  = quotedId ? allEvents.find(e => e.id === quotedId) : null;
            const displayContent = (isQuote && quotedEv)
              ? event.content.replace(/\nnostr:(?:note1|nevent1|naddr1)\S*/gi, "").replace(/nostr:(?:note1|nevent1|naddr1)\S*/gi, "").trim()
              : event.content;
            const goalClosed = isGoal && (() => {
              const ts = event.tags?.find(t => t[0] === "closed_at")?.[1];
              return ts ? Math.floor(Date.now() / 1000) > Number(ts) : false;
            })();
            return (
              <>
                {isGoal && displayContent ? (
                  <div className="zap-goal-title-row">
                    <NoteContent content={displayContent} tags={event.tags} profiles={profiles} onOpenProfile={onOpenProfile}
                      onOpenHashtag={onOpenHashtag}
                      allEvents={allEvents}
                      onOpenThread={onOpenThread}
                      resolveEventById={resolveEventById}
                      className="note-text"
                      collapsible={!focused} />
                    <span className="zap-goal-badge">⚡ Goal</span>
                    {goalClosed && <span className="zap-goal-badge zap-goal-badge-closed">Closed</span>}
                  </div>
                ) : displayContent ? (
                  <NoteContent content={displayContent} tags={event.tags} profiles={profiles} onOpenProfile={onOpenProfile}
                    onOpenHashtag={onOpenHashtag}
                    allEvents={allEvents}
                    onOpenThread={onOpenThread}
                    resolveEventById={resolveEventById}
                    onOpenCalendarEvent={onOpenCalendarEvent}
                    className="note-text"
                    collapsible={!focused} />
                ) : null}
                {isGoal && <ZapGoalProgressBlock event={event} hideBadge />}
                {isPoll && (
                  <PollInline
                    event={event}
                    myPubkey={myPubkey}
                    sendZap={sendZap}
                    defaultZapAmount={defaultZapAmount}
                    defaultZapMsg={defaultZapMsg}
                    onZapFail={onZapFail}
                    profiles={profiles}
                    publishEvent={publishEvent}
                    onRequestModal={onRequestModal}
                    onDismissModal={onDismissModal}
                    onOpenVotes={onOpenPollVotes}
                  />
                )}
                {isQuote && quotedEv && (() => {
                  const qKind = quotedEv.kind;
                  if (qKind === 1068 || qKind === 6969) {
                    const isZapPoll = qKind === 6969;
                    const opts = quotedEv.tags
                      .filter(t => t[0] === (isZapPoll ? "poll_option" : "option") && t[1] && t[2])
                      .map(t => ({ id: t[1], label: t[2] }));
                    return (
                      <div className="note-embed" onClick={e => { e.stopPropagation(); (onOpenPoll ?? onOpenThread)?.(quotedEv); }}>
                        <div className="note-embed-head">
                          <Avatar pk={quotedEv.pubkey} profiles={profiles} size={20} />
                          <span className="note-embed-name" onClick={e => { e.stopPropagation(); onOpenProfile?.(quotedEv.pubkey); }}>{displayName(quotedEv.pubkey, profiles)}</span>
                          <span className="poll-badge" style={{ marginLeft: "auto" }}>{isZapPoll ? "⚡ Zap Poll" : "Poll"}</span>
                        </div>
                        {quotedEv.content && (
                          <NoteContent content={quotedEv.content} tags={quotedEv.tags} profiles={profiles} allowEmbeds={false} className="note-text" />
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                          {opts.map(opt => (
                            <button key={opt.id} type="button" className="poll-option-btn" disabled style={{ pointerEvents: "none" }}>
                              {isZapPoll && <span className="poll-zap-icon">⚡</span>}{opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  if (qKind === 9041) {
                    return (
                      <div className="note-embed" onClick={e => { e.stopPropagation(); (onOpenGoal ?? onOpenThread)?.(quotedEv); }}>
                        <div className="note-embed-head">
                          <Avatar pk={quotedEv.pubkey} profiles={profiles} size={20} />
                          <span className="note-embed-name" onClick={e => { e.stopPropagation(); onOpenProfile?.(quotedEv.pubkey); }}>{displayName(quotedEv.pubkey, profiles)}</span>
                        </div>
                        <div className="zap-goal-title-row" style={{ marginBottom: 4 }}>
                          <NoteContent content={quotedEv.content} tags={quotedEv.tags} profiles={profiles} allowEmbeds={false} className="note-text" />
                          <span className="zap-goal-badge">⚡ Goal</span>
                        </div>
                        <ZapGoalProgressBlock event={quotedEv} hideBadge />
                      </div>
                    );
                  }
                  if (qKind === 31922 || qKind === 31923) {
                    return <CalendarInlineCard event={quotedEv} onOpen={onOpenCalendarEvent ?? onOpenThread} />;
                  }
                  return (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", background: "var(--surface)", marginTop: 6, cursor: "pointer" }}
                      onClick={e => { e.stopPropagation(); onOpenThread?.(quotedEv); }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                        <Avatar pk={quotedEv.pubkey} profiles={profiles} size={20} />
                        <span style={{ fontSize: 12, fontWeight: 500 }} onClick={e => { e.stopPropagation(); onOpenProfile?.(quotedEv.pubkey); }}>
                          {displayName(quotedEv.pubkey, profiles)}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto" }}>{relativeTime(quotedEv.created_at)}</span>
                      </div>
                      <NoteContent content={quotedEv.content} tags={quotedEv.tags} profiles={profiles} onOpenProfile={onOpenProfile}
                        allEvents={allEvents} onOpenThread={onOpenThread} resolveEventById={resolveEventById}
                        className="note-text" style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }} />
                    </div>
                  );
                })()}
              </>
            );
          })()}
          </div>
          {focused && (
            <FocusedStatsRow eventId={event.id} rCount={rCount} allEvents={allEvents}
              zaps={zaps} reactions={reactions}
              onOpenZaps={onOpenZaps} onOpenReactions={onOpenReactions} onOpenReposts={onOpenReposts} />
          )}
          {(focused || isParent || isReply || isSelf) && (
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
              sendZap={sendZap} defaultZapAmount={defaultZapAmount}
              defaultZapMsg={defaultZapMsg} onZapFail={onZapFail}
              customEmojis={customEmojis}
            />
          )}
    </div>
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

const Connector = ({ chain = false }) => (
  <div className="thread-connector">
    <div className={`thread-connector-line${chain ? " chain" : ""}`} />
  </div>
);

export default function ThreadView({
  focusedEvent, events, profiles, onBack, onOpenProfile, onOpenThread, onOpenHashtag,
  onOpenZaps, onOpenReactions, onOpenReposts,
  myPubkey, myProfile, onPublish, publishEvent, onPrepend, onBookmark, isBookmarked,
  publishHighlight,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction, onRequestModal, onDismissModal,
  sendZap, defaultZapAmount, defaultZapMsg, onZapFail,
  resolveEventById, onOpenPollVotes,
  customEmojis,
}) {
  const containerRef = useRef(null);
  const focusRef     = useRef(null);
  const authorPk     = focusedEvent.pubkey;
  const [threadMenuId, setThreadMenuId]     = useState(null);
  const [threadJsonEvent, setThreadJsonEvent] = useState(null);
  const [fetchedEvents, setFetchedEvents] = useState([]);

  const allEvents = useMemo(() => {
    const map = new Map(events.map(e => [e.id, e]));
    for (const e of fetchedEvents) map.set(e.id, e);
    return [...map.values()];
  }, [events, fetchedEvents]);

  // Fetch profiles for thread participants (includes freshly-fetched parent chain authors
  // not present in the global allPks from App)
  const threadPubkeys = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const ev of allEvents) {
      if (!seen.has(ev.pubkey)) { seen.add(ev.pubkey); result.push(ev.pubkey); }
      for (const t of ev.tags || []) {
        if (t[0] === "p" && t[1] && !seen.has(t[1])) { seen.add(t[1]); result.push(t[1]); }
      }
    }
    return result;
  }, [allEvents]);
  const { profiles: localProfiles } = useProfiles({ pubkeys: threadPubkeys });
  const mergedProfiles = useMemo(() => ({ ...profiles, ...localProfiles }), [profiles, localProfiles]);

  // Fetch ancestor chain and subscribe to replies whenever the focused event changes
  useEffect(() => {
    setFetchedEvents([]);
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    const known = new Map(events.map(e => [e.id, e]));
    const subs = [];

    // Walk up ancestors: fetch missing parent IDs from e-tags, up to 5 levels
    const fetchAncestors = (ev, depth) => {
      if (depth <= 0) return;
      const parentIds = ev.tags
        .filter(t => t[0] === "e" && t[3] !== "mention" && t[1])
        .map(t => t[1])
        .filter(id => !known.has(id));
      if (!parentIds.length) return;
      const sub = pool.request(relayUrls, [{ ids: parentIds }]).subscribe({
        next: fetched => {
          if (known.has(fetched.id)) return;
          known.set(fetched.id, fetched);
          eventStore.add(fetched);
          setFetchedEvents(prev => [...prev, fetched]);
          fetchAncestors(fetched, depth - 1);
        },
      });
      subs.push(sub);
    };
    fetchAncestors(focusedEvent, 5);

    // Subscribe to replies (kind 1) and NIP-22 comments (kind 1111)
    const replySub = pool.subscription(relayUrls, [{
      kinds: [1, 1111],
      "#e": [focusedEvent.id],
      since: focusedEvent.created_at,
    }]).subscribe({
      next: ev => {
        if (known.has(ev.id)) return;
        known.set(ev.id, ev);
        eventStore.add(ev);
        setFetchedEvents(prev => [...prev, ev]);
      },
    });
    subs.push(replySub);

    // Backfill all zaps for the focused event — the feed's broad metaSub can miss
    // these (no #e filter, 48h window, 500-event limit)
    const zapFetch = pool.request(relayUrls, [{
      kinds: [9735],
      "#e": [focusedEvent.id],
    }]).subscribe({
      next: raw => {
        const bolt11 = raw.tags.find(t => t[0] === "bolt11")?.[1];
        if (!bolt11) return;
        const msats = parseBolt11Msats(bolt11);
        if (!msats) return;
        const zapper  = zapperPubkeyFromKind9735(raw) ?? raw.pubkey;
        const comment = zapCommentFromKind9735(raw) ?? "";
        addLocalZap?.(focusedEvent.id, { id: raw.id, zapper, amount: msats, comment });
      },
    });
    subs.push(zapFetch);

    // Backfill all reactions for the focused event — feed metaSub uses #p filter
    // which misses reactions from users who aren't in the follows list
    const reactionFetch = pool.request(relayUrls, [{
      kinds: [7],
      "#e": [focusedEvent.id],
    }]).subscribe({
      next: raw => {
        if (raw.kind !== 7 || !raw.content) return;
        setLocalReaction?.(focusedEvent.id, raw.pubkey, raw.content === "+" ? "💜" : raw.content, { id: raw.id, tags: raw.tags });
      },
    });
    subs.push(reactionFetch);

    return () => subs.forEach(s => s.unsubscribe());
  }, [focusedEvent.id]); // eslint-disable-line

  const parents    = buildParentChain(focusedEvent, allEvents);
  const selfChain  = buildSelfReplyChain(focusedEvent, allEvents, authorPk);

  const chainIds = new Set([
    ...parents.map(e => e.id),
    focusedEvent.id,
    ...selfChain.map(e => e.id),
  ]);

  const otherReplies = allEvents.filter(e => {
    if ((e.kind !== 1 && e.kind !== 1111) || chainIds.has(e.id) || isQuoteRepost(e)) return false;
    return directReplyParentId(e) === focusedEvent.id;
  }).sort((a, b) => a.created_at - b.created_at);

  const rowProps = {
    profiles: mergedProfiles, allEvents,
    onOpenProfile, onOpenThread, onOpenHashtag,
    onOpenZaps, onOpenReactions, onOpenReposts,
    myPubkey, myProfile, onPublish, publishEvent, onPrepend,
    publishHighlight,
    onBookmark, isBookmarked, getLocalZaps, addLocalZap,
    getLocalReactions, setLocalReaction, onRequestModal, onDismissModal,
    sendZap, defaultZapAmount, defaultZapMsg, onZapFail,
    resolveEventById, onOpenPollVotes,
    threadMenuId, setThreadMenuId, onShowThreadJson: setThreadJsonEvent,
    customEmojis,
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
            <MutedNoteGate key={e.id} event={e} profiles={mergedProfiles} onOpenProfile={onOpenProfile}>
              <ThreadNoteRow event={e} variant="reply" hasConnector={false} {...rowProps} />
            </MutedNoteGate>
          ))}
        </>
      )}

      {otherReplies.length === 0 && selfChain.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 32 }}>
          <div className="empty-state-sub">No replies yet</div>
        </div>
      )}

      {threadJsonEvent && <NoteJsonModal event={threadJsonEvent} onClose={() => setThreadJsonEvent(null)} />}
    </div>
  );
}
