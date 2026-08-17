import { isQuoteRepost } from "../utils.js";

export default function FocusedStatsRow({ eventId, additionalEventIds = [], rCount, allEvents, zaps, reactions, onOpenZaps, onOpenReactions, onOpenReposts }) {
  const targetIds = [eventId, ...additionalEventIds];
  const kind6Pubkeys = (allEvents || [])
    .filter(e => e.kind === 6 && e.tags.some(t => t[0] === "e" && targetIds.includes(t[1])))
    .map(e => e.pubkey);

  const quoteRepostEvs = (allEvents || []).filter(e =>
    e.kind === 1 && !targetIds.includes(e.id) && e.tags.some(t => t[0] === "q" && targetIds.includes(t[1]))
  );

  const repostItems = [
    ...kind6Pubkeys.map(pk => ({ type: "repost", pubkey: pk })),
    ...quoteRepostEvs.map(e => ({
      type: "quote", pubkey: e.pubkey, event: e,
      quotedEvent: (allEvents || []).find(ev => ev.id === eventId) || null,
    })),
  ];

  const hasAny = zaps?.length || reactions?.length || repostItems.length || rCount > 0;
  if (!hasAny) return null;

  return (
    <div className="note-stats focused" onClick={e => e.stopPropagation()}>
      {zaps?.length > 0 && (
        <button className="note-stat-btn" onClick={() => onOpenZaps?.({ eventId, zaps })}>
          <span className="note-stat-val">{zaps.length}</span> {zaps.length === 1 ? "zap" : "zaps"}
        </button>
      )}
      {reactions?.length > 0 && (
        <button className="note-stat-btn" onClick={() => onOpenReactions?.({ eventId, reactions })}>
          <span className="note-stat-val">{reactions.length}</span> {reactions.length === 1 ? "reaction" : "reactions"}
        </button>
      )}
      {rCount > 0 && (
        <span className="note-stat-btn" style={{ cursor: "default" }}>
          <span className="note-stat-val">{rCount}</span> {rCount === 1 ? "reply" : "replies"}
        </span>
      )}
      {repostItems.length > 0 && (
        <button className="note-stat-btn" onClick={() => onOpenReposts?.({ eventId, reposts: repostItems })}>
          <span className="note-stat-val">{repostItems.length}</span> {repostItems.length === 1 ? "repost" : "reposts"}
        </button>
      )}
    </div>
  );
}
