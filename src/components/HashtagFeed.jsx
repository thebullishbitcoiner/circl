import { useState, useEffect, useRef } from "react";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";
import { replyCount, repostAndQuoteCount } from "../utils.js";
import NoteCard from "./NoteCard.jsx";
import MutedNoteGate from "./MutedNoteGate.jsx";
import { Bk } from "./icons.jsx";

const hashtagCache = new Map(); // hashtag → { notes, ts }
const HASHTAG_CACHE_TTL = 5 * 60 * 1000;

export default function HashtagFeed({
  hashtag, profiles, onBack, onOpenProfile, onOpenThread, onOpenHashtag,
  myPubkey, myProfile, onBookmark, isBookmarked,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  publishEvent, onPrepend, onOpenZaps, onOpenReactions, onOpenReposts,
  sendZap, defaultZapAmount, defaultZapMsg, onZapFail, resolveEventById,
  customEmojis,
}) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const subRef = useRef(null);

  useEffect(() => {
    if (!hashtag) return;
    const key = hashtag.toLowerCase();
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;

    const cached = hashtagCache.get(key);
    if (cached && Date.now() - cached.ts < HASHTAG_CACHE_TTL) {
      setNotes(cached.notes);
      setLoading(false);
      return;
    }

    setNotes([]);
    setLoading(true);

    // Use group(relays, false) so offline/not-yet-connected outbox relays are included
    const sub = pool.group(relayUrls, false).request([{ kinds: [1], "#t": [key], limit: 100 }]).subscribe({
      next: ev => {
        eventStore.add(ev);
        setNotes(prev => {
          if (prev.some(e => e.id === ev.id)) return prev;
          const next = [ev, ...prev].sort((a, b) => b.created_at - a.created_at);
          hashtagCache.set(key, { notes: next, ts: Date.now() });
          return next;
        });
      },
      error: () => setLoading(false),
      complete: () => setLoading(false),
    });

    subRef.current = sub;
    const t = setTimeout(() => setLoading(false), 8000);
    return () => { sub.unsubscribe(); clearTimeout(t); };
  }, [hashtag]);

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <button type="button" className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span className="panel-bar-logo">#{hashtag}</span>
      </div>

      {loading && notes.length === 0 && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <div style={{ width: 22, height: 22, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        </div>
      )}

      {!loading && notes.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 48 }}>
          <div className="empty-state-title">No notes found</div>
          <div className="empty-state-sub">#{hashtag}</div>
        </div>
      )}

      {notes.map((ev, i) => (
        <MutedNoteGate key={ev.id} event={ev} profiles={profiles} onOpenProfile={onOpenProfile}>
        <NoteCard
          key={ev.id}
          event={ev}
          events={notes}
          resolveEventById={resolveEventById}
          profiles={profiles}
          liked={false}
          bookmarked={isBookmarked?.(ev) || false}
          likeCount={0}
          replyCount={replyCount(ev.id, notes)}
          repostCount={repostAndQuoteCount(ev.id, notes)}
          myPubkey={myPubkey}
          myProfile={myProfile}
          onLike={() => {}}
          onBookmark={onBookmark}
          onOpenProfile={onOpenProfile}
          onOpenThread={onOpenThread}
          onOpenHashtag={onOpenHashtag}
          onOpenZaps={onOpenZaps}
          onOpenReactions={onOpenReactions}
          onOpenReposts={onOpenReposts}
          onPublish={onPrepend}
          publishEvent={publishEvent}
          onPrepend={onPrepend}
          getLocalZaps={getLocalZaps}
          addLocalZap={addLocalZap}
          getLocalReactions={getLocalReactions}
          setLocalReaction={setLocalReaction}
          sendZap={sendZap}
          defaultZapAmount={defaultZapAmount}
          defaultZapMsg={defaultZapMsg}
          onZapFail={onZapFail}
          customEmojis={customEmojis}
          delay={i * 0.03}
        />
        </MutedNoteGate>
      ))}
    </div>
  );
}
