import LongformCard from "./LongformCard.jsx";
import NoteCard from "./NoteCard.jsx";
import RepostCard from "./RepostCard.jsx";
import PollCard from "./PollCard.jsx";
import CalendarCard from "./CalendarCard.jsx";
import StreamCard from "./StreamCard.jsx";
import HighlightCard from "./HighlightCard.jsx";
import ZapGoalCard from "./ZapGoalCard.jsx";
import { replyCount, repostAndQuoteCount } from "../utils.js";

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
  delay = 0,
}) {
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
  };

  if (event.kind === 30023) {
    return (
      <LongformCard
        key={event.id}
        event={event}
        profiles={profiles}
        liked={like.liked}
        bookmarked={isBookmarked?.(event) || false}
        likeCount={like.count}
        onLike={onLike}
        onBookmark={onBookmark}
        onOpen={onOpenArticle}
        onOpenProfile={onOpenProfile}
        delay={delay}
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
      delay={delay}
    />
  );
}
