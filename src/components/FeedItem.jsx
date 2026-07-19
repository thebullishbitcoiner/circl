import { useState } from "react";
import LongformCard from "./LongformCard.jsx";
import NoteCard from "./NoteCard.jsx";
import RepostCard from "./RepostCard.jsx";
import PollCard from "./PollCard.jsx";
import CalendarCard from "./CalendarCard.jsx";
import StreamCard from "./StreamCard.jsx";
import HighlightCard from "./HighlightCard.jsx";
import ZapGoalCard from "./ZapGoalCard.jsx";
import PodcastZapCard from "./PodcastZapCard.jsx";
import Avatar from "./Avatar.jsx";
import { replyCount, repostAndQuoteCount, displayName, nip05OrNpub, relativeTime } from "../utils.js";
import { useNavigation } from "../context/NavigationContext.jsx";

/**
 * Dispatches a Nostr event to the correct card component.
 *
 * Accepts a unified prop surface so callers don't need to duplicate the
 * kind→component mapping. Add new content types here only.
 */
export default function FeedItem({
  event,
  // data
  profiles, events = [], resolveEventById,
  myPubkey, myProfile,
  // openers
  onOpenProfile, onOpenThread, onOpenHashtag,
  onOpenArticle, onOpenStream,
  onOpenZaps, onOpenReactions, onOpenReposts, onOpenPollVotes,
  // interactions — getLike/onLike are optional (cards using NoteActions handle their own state)
  getLike, onLike,
  isBookmarked, onBookmark,
  onPublish, publishEvent, onPrepend,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  onRequestModal, onDismissModal,
  sendZap, defaultZapAmount, defaultZapMsg, onZapFail,
  customEmojis,
  delay = 0,
  skipUserMuteGate = false,
}) {
  const { isMuted, isContentMuted } = useNavigation();
  const [revealed, setRevealed] = useState(false);
  const muteReason = revealed ? null : (isContentMuted?.(event) || (!skipUserMuteGate && isMuted?.(event?.pubkey) ? "user" : null));

  if (muteReason) {
    return (
      <div className="note-card" style={{ animationDelay: `${delay}s` }}>
        {event.kind === 6 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-faint)", marginBottom: 4, paddingLeft: 2 }}>
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span style={{ cursor: "pointer", fontWeight: 500 }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
              {displayName(event.pubkey, profiles)}
            </span>
            &nbsp;reposted
          </div>
        ) : (
        <div className="note-header">
          <div style={{ flexShrink: 0, cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
            <Avatar pk={event.pubkey} profiles={profiles} size={36} />
          </div>
          <div className="note-meta">
            <div className="note-meta-top">
              <span className="note-name" style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>{displayName(event.pubkey, profiles)}</span>
              <span className="meta-dot" aria-hidden="true">·</span>
              <span className="note-time">{relativeTime(event.created_at)}</span>
            </div>
            <span className="note-npub">{nip05OrNpub(event.pubkey, profiles)}</span>
          </div>
          <button type="button" className="note-card-menu-btn" style={{ opacity: 0.3, cursor: "default" }} disabled>
            <span /><span /><span />
          </button>
        </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0 6px" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif" }}>
            {muteReason === "user" ? "Muted user" : muteReason === "thread" ? "Muted thread" : <>Muted · <span style={{ color: "var(--text-faint)" }}>{muteReason}</span></>}
          </span>
          <button
            type="button"
            onClick={() => setRevealed(true)}
            style={{ flexShrink: 0, fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: "var(--primary)", background: "transparent", border: "1px solid var(--primary)", borderRadius: 20, padding: "3px 12px", cursor: "pointer" }}
          >
            Show
          </button>
        </div>
      </div>
    );
  }

  const like = getLike?.(event.id) ?? { liked: false, count: 0 };

  // Shared props for cards that use NoteActions internally
  const noteActionProps = {
    profiles, myPubkey, myProfile, events,
    onOpenThread, onOpenZaps, onOpenReactions, onOpenReposts,
    onPublish, publishEvent, onPrepend,
    onBookmark, isBookmarked,
    getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
    onRequestModal, onDismissModal,
    sendZap, defaultZapAmount, defaultZapMsg, onZapFail,
    customEmojis,
  };

  if (event.kind === 30023) {
    return (
      <LongformCard
        key={event.id}
        event={event}
        profiles={profiles}
        onOpen={onOpenArticle}
        onOpenProfile={onOpenProfile}
        delay={delay}
        {...noteActionProps}
      />
    );
  }

  if (event.kind === 6) {
    return (
      <RepostCard
        key={event.id}
        event={event}
        profiles={profiles}
        events={events}
        resolveEventById={resolveEventById}
        myPubkey={myPubkey}
        myProfile={myProfile}
        onOpenProfile={onOpenProfile}
        onOpenThread={onOpenThread}
        onOpenHashtag={onOpenHashtag}
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
        onOpenPollVotes={onOpenPollVotes}
        customEmojis={customEmojis}
        delay={delay}
      />
    );
  }

  if (event.kind === 9041) {
    return (
      <ZapGoalCard
        key={event.id}
        event={event}
        events={events}
        resolveEventById={resolveEventById}
        profiles={profiles}
        myPubkey={myPubkey}
        myProfile={myProfile}
        onOpenProfile={onOpenProfile}
        onOpenThread={onOpenThread}
        onOpenHashtag={onOpenHashtag}
        {...noteActionProps}
        delay={delay}
      />
    );
  }

  if (event.kind === 1068 || event.kind === 6969) {
    return (
      <PollCard
        key={event.id}
        event={event}
        events={events}
        resolveEventById={resolveEventById}
        profiles={profiles}
        myPubkey={myPubkey}
        myProfile={myProfile}
        onOpenProfile={onOpenProfile}
        onOpenThread={onOpenThread}
        onOpenHashtag={onOpenHashtag}
        onOpenVotes={onOpenPollVotes}
        {...noteActionProps}
        delay={delay}
      />
    );
  }

  if (event.kind === 31922 || event.kind === 31923) {
    return (
      <CalendarCard
        key={event.id}
        event={event}
        profiles={profiles}
        myPubkey={myPubkey}
        myProfile={myProfile}
        events={events}
        onOpenProfile={onOpenProfile}
        onOpenThread={onOpenThread}
        onOpenHashtag={onOpenHashtag}
        {...noteActionProps}
        delay={delay}
      />
    );
  }

  if (event.kind === 30311) {
    return (
      <StreamCard
        key={event.id}
        event={event}
        profiles={profiles}
        liked={like.liked}
        bookmarked={isBookmarked?.(event) || false}
        likeCount={like.count}
        onLike={onLike}
        onBookmark={onBookmark}
        onOpen={onOpenStream}
        onOpenProfile={onOpenProfile}
        delay={delay}
      />
    );
  }

  if (event.kind === 9735) {
    return (
      <PodcastZapCard
        key={event.id}
        event={event}
        profiles={profiles}
        onOpenProfile={onOpenProfile}
        onOpenStream={onOpenStream}
        delay={delay}
      />
    );
  }

  if (event.kind === 9802) {
    return (
      <HighlightCard
        key={event.id}
        event={event}
        profiles={profiles}
        liked={like.liked}
        bookmarked={isBookmarked?.(event) || false}
        likeCount={like.count}
        myPubkey={myPubkey}
        myProfile={myProfile}
        onLike={onLike}
        onBookmark={onBookmark}
        onOpenProfile={onOpenProfile}
        onOpenThread={onOpenThread}
        onOpenArticle={onOpenArticle}
        onOpenHashtag={onOpenHashtag}
        onOpenZaps={onOpenZaps}
        onOpenReactions={onOpenReactions}
        onOpenReposts={onOpenReposts}
        onPublish={onPublish}
        publishEvent={publishEvent}
        onPrepend={onPrepend}
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
        resolveEventById={resolveEventById}
        customEmojis={customEmojis}
        delay={delay}
      />
    );
  }

  return (
    <NoteCard
      key={event.id}
      event={event}
      events={events}
      resolveEventById={resolveEventById}
      profiles={profiles}
      liked={like.liked}
      bookmarked={isBookmarked?.(event) || false}
      likeCount={like.count}
      replyCount={replyCount(event.id, events)}
      repostCount={repostAndQuoteCount(event.id, events)}
      myPubkey={myPubkey}
      myProfile={myProfile}
      onLike={onLike}
      onBookmark={onBookmark}
      onOpenProfile={onOpenProfile}
      onOpenThread={onOpenThread}
      onOpenHashtag={onOpenHashtag}
      onOpenZaps={onOpenZaps}
      onOpenReactions={onOpenReactions}
      onOpenReposts={onOpenReposts}
      onPublish={onPublish}
      publishEvent={publishEvent}
      onPrepend={onPrepend}
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
      delay={delay}
    />
  );
}
