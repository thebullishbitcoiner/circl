import { useState, useEffect, useRef, useMemo } from "react";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";
import { replyCount, repostAndQuoteCount } from "../utils.js";
import { useNip05DomainMembers } from "../hooks/useNip05DomainMembers.js";
import useProfiles from "../hooks/useProfiles.js";
import NoteCard from "./NoteCard.jsx";
import MutedNoteGate from "./MutedNoteGate.jsx";
import { Bk } from "./icons.jsx";

const MAX_AUTHORS = 500;

const domainNotesCache = new Map(); // domain → { notes, ts }
const DOMAIN_NOTES_CACHE_TTL = 5 * 60 * 1000;

export default function Nip05DomainFeed({
  domain, profiles: profilesProp, onBack, onOpenProfile, onOpenThread, onOpenHashtag, onOpenMembers,
  myPubkey, myProfile, onBookmark, isBookmarked,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  publishEvent, onPrepend, onOpenZaps, onOpenReactions, onOpenReposts,
  sendZap, defaultZapAmount, defaultZapMsg, onZapFail, resolveEventById,
  customEmojis,
}) {
  const { pubkeys, loading: pubkeysLoading } = useNip05DomainMembers(domain);
  const { profiles: fetchedProfiles } = useProfiles({ pubkeys });
  const profiles = useMemo(() => ({ ...fetchedProfiles, ...profilesProp }), [profilesProp, fetchedProfiles]);

  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const subRef = useRef(null);

  useEffect(() => {
    if (pubkeysLoading || pubkeys.length === 0) {
      if (!pubkeysLoading) setNotesLoading(false);
      return;
    }
    const authors = pubkeys.slice(0, MAX_AUTHORS);
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;

    const cached = domainNotesCache.get(domain);
    if (cached && Date.now() - cached.ts < DOMAIN_NOTES_CACHE_TTL) {
      setNotes(cached.notes);
      setNotesLoading(false);
      return;
    }

    setNotes([]);
    setNotesLoading(true);

    const sub = pool.group(relayUrls, false).request([{ kinds: [1], authors, limit: 100 }]).subscribe({
      next: ev => {
        eventStore.add(ev);
        setNotes(prev => {
          if (prev.some(e => e.id === ev.id)) return prev;
          const next = [ev, ...prev].sort((a, b) => b.created_at - a.created_at);
          domainNotesCache.set(domain, { notes: next, ts: Date.now() });
          return next;
        });
      },
      error: () => setNotesLoading(false),
      complete: () => setNotesLoading(false),
    });

    subRef.current = sub;
    const t = setTimeout(() => setNotesLoading(false), 8000);
    return () => { sub.unsubscribe(); clearTimeout(t); };
  }, [domain, pubkeysLoading, pubkeys]);

  const loading = pubkeysLoading || notesLoading;

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <button type="button" className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span className="panel-bar-logo">{domain}</span>
        {!pubkeysLoading && pubkeys.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenMembers?.(domain)}
            style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: 50, fontSize: 11, fontWeight: 500, padding: "3px 10px", fontFamily: "'DM Sans',sans-serif", cursor: "pointer" }}
          >
            {pubkeys.length.toLocaleString()}
          </button>
        )}
      </div>

      {loading && notes.length === 0 && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <div style={{ width: 22, height: 22, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        </div>
      )}

      {!pubkeysLoading && pubkeys.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 48 }}>
          <div className="empty-state-title">No pubkeys found</div>
          <div className="empty-state-sub">{domain}/.well-known/nostr.json</div>
        </div>
      )}

      {!loading && pubkeys.length > 0 && notes.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 48 }}>
          <div className="empty-state-title">No notes found</div>
          <div className="empty-state-sub">{domain}</div>
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
