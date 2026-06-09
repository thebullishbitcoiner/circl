import { useState, useEffect } from "react";
import { useNavigation } from "../context/NavigationContext.jsx";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import NoteActions from "./NoteActions.jsx";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import PollInline from "./PollInline.jsx";
import { displayName, nip05OrNpub, relativeTime } from "../utils.js";
import CalendarInlineCard from "./CalendarInlineCard.jsx";

export default function RepostCard({
  event, profiles, events, myPubkey, myProfile,
  resolveEventById,
  onOpenProfile, onOpenThread, onOpenHashtag, onOpenZaps, onOpenReactions, onOpenReposts,
  onPublish, publishEvent, onPrepend, onBookmark, isBookmarked,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  onRequestModal, onDismissModal, delay,
  sendZap, defaultZapAmount, defaultZapMsg, onZapFail, onOpenPollVotes,
  customEmojis,
}) {
  const { onOpenCalendarEvent, onOpenPoll, onOpenGoal } = useNavigation();
  const originalId  = event.tags.find(t => t[0] === "e")?.[1];
  const fromContent = (() => { try { return JSON.parse(event.content); } catch { return null; } })();
  const fromPool    = originalId ? events.find(e => e.id === originalId) : null;
  const original    = fromPool || fromContent;
  const [menuOpen, setMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);

  useEffect(() => {
    if (!original && originalId) resolveEventById?.(originalId);
  }, [originalId, original]);

  return (
    <>
    <div className="note-card" style={{ animationDelay: `${delay}s`, zIndex: menuOpen ? 1 : undefined }}
      onClick={() => {
        if (!original) return;
        if (original.kind === 1068 || original.kind === 6969) { onOpenPoll?.(original); return; }
        if (original.kind === 9041) { onOpenGoal?.(original); return; }
        if (original.kind === 31922 || original.kind === 31923) { onOpenCalendarEvent?.(original); return; }
        onOpenThread?.(original);
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-faint)", marginBottom: 8, paddingLeft: 2 }}>
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        <span style={{ cursor: "pointer", fontWeight: 500 }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
          {displayName(event.pubkey, profiles)}
        </span>
        &nbsp;reposted
      </div>

      {original ? (
        <>
        <div className="note-header">
          <div onClick={e => { e.stopPropagation(); onOpenProfile?.(original.pubkey); }} style={{ cursor: "pointer", flexShrink: 0 }}>
            <Avatar pk={original.pubkey} profiles={profiles} size={36} />
          </div>
          <div className="note-meta">
            <span className="note-name" style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(original.pubkey); }}>
              {displayName(original.pubkey, profiles)}
            </span>
            <span className="note-npub">{nip05OrNpub(original.pubkey, profiles)}</span>
            <span className="note-time">{relativeTime(original.created_at)}</span>
          </div>
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
              event={original ?? event}
              onClose={() => setMenuOpen(false)}
              onViewJson={() => setJsonOpen(true)}
            />
          )}
        </div>
            {(original.kind === 31922 || original.kind === 31923)
              ? <CalendarInlineCard event={original} onOpen={onOpenCalendarEvent ?? onOpenThread} />
              : <NoteContent
                  content={original.content}
                  tags={original.tags}
                  profiles={profiles}
                  onOpenProfile={onOpenProfile}
                  onOpenHashtag={onOpenHashtag}
                  allEvents={events}
                  onOpenThread={onOpenThread}
                  resolveEventById={resolveEventById}
                  allowEmbeds={!(original.kind === 1068 || original.kind === 6969)}
                  collapsible
                />
            }
            {(original.kind === 1068 || original.kind === 6969) && (
              <PollInline
                event={original}
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
            <NoteActions
              event={original} profiles={profiles}
              myPubkey={myPubkey} myProfile={myProfile} events={events}
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
        </>
      ) : (
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-faint)", padding: "4px 0" }}>
          Original note not available
        </div>
      )}
    </div>
    {jsonOpen && <NoteJsonModal event={original ?? event} onClose={() => setJsonOpen(false)} />}
    </>
  );
}
