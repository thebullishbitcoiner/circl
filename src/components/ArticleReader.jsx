import { useState, useEffect, useRef } from "react";
import Avatar from "./Avatar.jsx";
import ArticleBody from "./ArticleBody.jsx";
import HighlightPopover from "./HighlightPopover.jsx";
import HighlightSheet from "./HighlightSheet.jsx";
import NoteActions from "./NoteActions.jsx";
import NoteCard from "./NoteCard.jsx";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import FocusedStatsRow from "./FocusedStatsRow.jsx";
import InlineCompose from "./InlineCompose.jsx";
import { Bk } from "./icons.jsx";
import { displayName, nip05OrNpub, parseArticle } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

export default function ArticleReader({
  event,
  profiles,
  onBack,
  onOpenProfile,
  allEvents = [],
  onOpenThread,
  onOpenHashtag,
  onOpenZaps,
  onOpenReactions,
  onOpenReposts,
  onOpenPollVotes,
  resolveEventById,
  publishHighlight,
  myPubkey,
  myProfile,
  publishEvent,
  onPublish,
  onPrepend,
  onBookmark,
  isBookmarked,
  getLike,
  onLike,
  getLocalZaps,
  addLocalZap,
  getLocalReactions,
  setLocalReaction,
  onRequestModal,
  onDismissModal,
  sendZap,
  defaultZapAmount,
  defaultZapMsg,
  onZapFail,
  customEmojis = [],
}) {
  const [highlightDraft, setHighlightDraft] = useState(null);
  const [comments, setComments] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const ref = useRef(null);
  const bodyRef = useRef(null);
  const progressBarRef = useRef(null);
  const art  = parseArticle(event);
  const name = displayName(event.pubkey, profiles);

  useEffect(() => {
    const el = ref.current;
    const bar = progressBarRef.current;
    if (!el || !bar) return;
    const fn = () => {
      const pct = Math.min((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100 || 0, 100);
      bar.style.width = `${pct}%`;
    };
    el.addEventListener("scroll", fn, { passive: true });
    return () => el.removeEventListener("scroll", fn);
  }, []);

  // Subscribe to replies/comments
  useEffect(() => {
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    const dTag = event.tags?.find(t => t[0] === "d")?.[1] ?? "";
    const addr = `${event.kind}:${event.pubkey}:${dTag}`;
    const known = new Map();
    const sub = pool.subscription(relayUrls, [
      { kinds: [1, 1111], "#e": [event.id] },
      { kinds: [1111], "#a": [addr] },
    ]).subscribe({
      next: ev => {
        if (known.has(ev.id)) return;
        if (ev.tags?.some(t => t[0] === "q")) return;
        known.set(ev.id, ev);
        eventStore.add(ev);
        setComments(prev => [...prev, ev].sort((a, b) => a.created_at - b.created_at));
      },
    });
    return () => sub.unsubscribe();
  }, [event.id]);

  // Fetch profiles for comment authors
  useEffect(() => {
    if (!comments.length) return;
    const pks = [...new Set(comments.map(c => c.pubkey))];
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    pool.request(relayUrls, [{ kinds: [0], authors: pks }]).subscribe({
      next: ev => eventStore.add(ev),
    });
  }, [comments.length]);

  function addComment(ev) {
    if (ev) setComments(prev => [...prev, ev].sort((a, b) => a.created_at - b.created_at));
    onPrepend?.(ev);
  }

  const sharedNoteProps = {
    profiles,
    myPubkey,
    myProfile,
    events: [...allEvents, ...comments],
    resolveEventById,
    onOpenProfile,
    onOpenThread,
    onOpenHashtag,
    onOpenZaps,
    onOpenReactions,
    onOpenReposts,
    onOpenPollVotes,
    onPublish,
    publishEvent,
    onPrepend,
    onBookmark,
    isBookmarked,
    getLocalZaps,
    addLocalZap,
    getLocalReactions,
    setLocalReaction,
    onRequestModal,
    onDismissModal,
    sendZap,
    defaultZapAmount,
    defaultZapMsg,
    onZapFail,
    customEmojis,
  };

  return (
    <>
    <div ref={ref} className="slide-panel-scroll">
      <div ref={progressBarRef} className="read-progress" />
      <div className="panel-bar">
        <button className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <div style={{ position: "relative", marginLeft: "auto" }}>
          <button
            type="button"
            className="note-card-menu-btn"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            aria-label="More options"
          >
            <span /><span /><span />
          </button>
          {menuOpen && (
            <NoteContextMenu
              event={event}
              onClose={() => setMenuOpen(false)}
              onViewJson={() => { setMenuOpen(false); setJsonOpen(true); }}
            />
          )}
        </div>
      </div>
      {jsonOpen && <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />}
      <div className="reader-hero">
        {art.image ? (
          <img className="reader-hero-image" src={art.image} alt={art.title} loading="eager" decoding="async" referrerPolicy="no-referrer" />
        ) : (
          <div className="reader-hero-glyph">✦</div>
        )}
      </div>
      <div className="reader-content">
        <div className="reader-header">
          <div className="r-article-dateline">
            {new Date(event.created_at * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {(() => { const c = event.tags?.find(t => t[0] === "client")?.[1]; return c ? <><span className="meta-dot"> · </span>via {c}</> : null; })()}
          </div>
          <div className="reader-title">{art.title}</div>
          {art.summary && <div className="reader-summary">{art.summary}</div>}
          {art.hashtags?.length ? (
            <div className="reader-hashtags">
              {art.hashtags.map(t => <span key={t} onClick={() => onOpenHashtag?.(t)} style={{ cursor: "pointer" }}>#{t}</span>)}
            </div>
          ) : null}
          <div className="reader-meta">
            <div className="r-author-row" onClick={() => onOpenProfile?.(event.pubkey)} style={{ cursor: "pointer" }}>
              <div className="r-av"><Avatar pk={event.pubkey} profiles={profiles} size={34} /></div>
              <div>
                <div className="r-author-name">{name}</div>
                <div className="r-author-npub">{nip05OrNpub(event.pubkey, profiles)}</div>
              </div>
            </div>
          </div>

          <FocusedStatsRow
            eventId={event.id}
            rCount={comments.length}
            allEvents={allEvents}
            zaps={getLocalZaps?.(event.id) ?? []}
            reactions={getLocalReactions?.(event.id) ?? []}
            onOpenZaps={onOpenZaps}
            onOpenReactions={onOpenReactions}
            onOpenReposts={onOpenReposts}
          />

          <div className="reader-header-actions">
            <NoteActions
              event={event}
              profiles={profiles}
              myPubkey={myPubkey}
              myProfile={myProfile}
              events={allEvents}
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
              onRequestModal={onRequestModal}
              onDismissModal={onDismissModal}
              sendZap={sendZap}
              defaultZapAmount={defaultZapAmount}
              defaultZapMsg={defaultZapMsg}
              onZapFail={onZapFail}
              customEmojis={customEmojis}
            />
          </div>
        </div>

        <div ref={bodyRef} style={{ position: "relative" }}>
          {publishHighlight && (
            <HighlightPopover
              sourceEvent={event}
              containerRef={bodyRef}
              onHighlight={draft => setHighlightDraft(draft)}
            />
          )}
          <ArticleBody
            content={event.content}
            profiles={profiles}
            onOpenProfile={onOpenProfile}
            allEvents={allEvents}
            onOpenThread={onOpenThread}
            resolveEventById={resolveEventById}
          />
        </div>


        <div className="cal-comments-section">
          <div className="cal-comments-header">
            <span className="cal-comments-title">Comments</span>
            {comments.length > 0 && (
              <span className="cal-comments-badge">{comments.length}</span>
            )}
          </div>

          <div className="cal-comments-feed">
            {comments.map(c => {
              const like = getLike?.(c.id) ?? { liked: false, count: 0 };
              return (
                <NoteCard
                  key={c.id}
                  event={c}
                  liked={like.liked}
                  likeCount={like.count}
                  bookmarked={isBookmarked?.(c) || false}
                  onLike={onLike}
                  {...sharedNoteProps}
                />
              );
            })}
          </div>

          <InlineCompose
            replyTo={event}
            myPubkey={myPubkey}
            myProfile={myProfile}
            profiles={profiles}
            events={[...allEvents, ...comments]}
            publishEvent={publishEvent}
            onSuccess={addComment}
            customEmojis={customEmojis}
          />
        </div>
      </div>
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
