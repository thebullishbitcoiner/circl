import { useEffect } from "react";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import NoteActions from "./NoteActions.jsx";
import ZapGoalProgressBlock from "./ZapGoalProgressBlock.jsx";
import { Bk } from "./icons.jsx";
import { displayName, nip05OrNpub, relativeTime, fmtSats } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";
import useGoalProgress from "../hooks/useGoalProgress.js";


export default function ZapGoalPage({
  event, profiles,
  myPubkey, myProfile,
  onBack, onOpenProfile,
  onOpenThread, onOpenHashtag,
  onOpenZaps, onOpenReactions, onOpenReposts,
  onPublish, publishEvent, onPrepend,
  onBookmark, isBookmarked,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  onRequestModal, onDismissModal,
  sendZap, defaultZapAmount = 21, defaultZapMsg = "", onZapFail,
  customEmojis,
}) {
  const { zaps, isClosed } = useGoalProgress(event);
  const sortedZaps = [...zaps].sort((a, b) => b.amount - a.amount);
  const hasUniqTop = sortedZaps.length >= 2 && sortedZaps[0]?.amount > sortedZaps[1]?.amount;

  const image    = event.tags?.find(t => t[0] === "image")?.[1] || null;
  const closedAt = event.tags?.find(t => t[0] === "closed_at")?.[1];

  // Fetch profiles for all zappers as they arrive
  useEffect(() => {
    if (!zaps.length) return;
    const pubkeys = [...new Set(zaps.map(z => z.zapper).filter(Boolean))];
    const toFetch = pubkeys.filter(pk => !profiles?.[pk]);
    if (!toFetch.length) return;
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    pool.request(relayUrls, [{ kinds: [0], authors: toFetch }]).subscribe({
      next: ev => eventStore.add(ev),
    });
  }, [zaps.length]);

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <button className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Zap Goal</span>
      </div>

      <div style={{ padding: "4px 16px 0" }}>
        {/* Author header */}
        <div className="note-header" style={{ marginBottom: 10 }}>
          <div onClick={() => onOpenProfile?.(event.pubkey)} style={{ cursor: "pointer", flexShrink: 0 }}>
            <Avatar pk={event.pubkey} profiles={profiles} size={36} />
          </div>
          <div className="note-meta">
            <span className="note-name" style={{ cursor: "pointer" }} onClick={() => onOpenProfile?.(event.pubkey)}>
              {displayName(event.pubkey, profiles)}
            </span>
            <span className="note-npub">{nip05OrNpub(event.pubkey, profiles)}</span>
            <span className="meta-dot" aria-hidden="true">·</span>
            <span className="note-time">{relativeTime(event.created_at)}</span>
          </div>
        </div>

        {/* Optional image */}
        {image && (
          <div className="zap-goal-image" style={{ marginBottom: 10 }}>
            <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          </div>
        )}

        {/* Title + inline badge */}
        <div className="zap-goal-title-row">
          <NoteContent
            content={event.content}
            tags={event.tags}
            profiles={profiles}
            onOpenProfile={onOpenProfile}
            onOpenHashtag={onOpenHashtag}
            allowEmbeds={false}
            className="note-text"
          />
          <span className="zap-goal-badge">⚡ Goal</span>
          {isClosed && <span className="zap-goal-badge zap-goal-badge-closed">Closed</span>}
        </div>

        {/* Progress block (summary + bar) */}
        <ZapGoalProgressBlock event={event} hideBadge />

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
          isBookmarked={isBookmarked}
          getLocalZaps={getLocalZaps}
          addLocalZap={addLocalZap}
          getLocalReactions={getLocalReactions}
          setLocalReaction={setLocalReaction}
          sendZap={sendZap}
          defaultZapAmount={defaultZapAmount}
          defaultZapMsg={defaultZapMsg}
          onZapFail={onZapFail}
          customEmojis={customEmojis}
          onRequestModal={onRequestModal}
          onDismissModal={onDismissModal}
        />
      </div>

      {/* Contributors */}
      <div className="zap-goal-contributors-head">
        <span>Contributors</span>
        {sortedZaps.length > 0 && (
          <span className="zap-goal-contributors-count">{sortedZaps.length}</span>
        )}
      </div>

      {sortedZaps.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-title">No contributions yet</div>
          <div className="empty-state-sub">Be the first to zap this goal</div>
        </div>
      ) : (
        sortedZaps.map((z, i) => (
          <div key={z.id || i} className="list-row" onClick={() => onOpenProfile?.(z.zapper)}>
            <div className={`list-row-av${hasUniqTop && i === 0 ? " top" : ""}`}>
              <Avatar pk={z.zapper} profiles={profiles} size={36} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="list-row-name">
                {displayName(z.zapper, profiles)}
                {hasUniqTop && i === 0 && <span className="list-badge">top zap</span>}
              </div>
              {z.comment && <div className="list-row-meta">{z.comment}</div>}
            </div>
            <div className="list-row-right">{fmtSats(z.amount)}</div>
          </div>
        ))
      )}
    </div>
  );
}
