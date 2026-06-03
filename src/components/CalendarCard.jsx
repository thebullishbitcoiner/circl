import { useState } from "react";
import { useNavigation } from "../context/NavigationContext.jsx";
import Avatar from "./Avatar.jsx";
import NoteActions from "./NoteActions.jsx";
import { displayName, nip05OrNpub, relativeTime, parseCalendarEvent, formatCalendarDate } from "../utils.js";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";

const MapPin = () => (
  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

export default function CalendarCard({
  event, profiles, onOpenProfile, delay,
  myPubkey, myProfile, events,
  onOpenThread, onOpenZaps, onOpenReactions, onOpenReposts,
  onPublish, publishEvent, onPrepend, onBookmark, isBookmarked,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  onRequestModal, onDismissModal,
  sendZap, defaultZapAmount, defaultZapMsg, onZapFail,
}) {
  const { onOpenCalendarEvent } = useNavigation();
  const cal = parseCalendarEvent(event);
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);

  const dateStr = formatCalendarDate(cal.start, cal.end, cal.isDateBased);
  const location = cal.locations[0] ?? null;

  return (
    <>
    <div className="calendar-card" style={{ animationDelay: `${delay}s`, zIndex: cardMenuOpen ? 1 : undefined }} onClick={() => onOpenCalendarEvent(event)}>
      <div className="note-header">
        <div onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} style={{ cursor: "pointer", flexShrink: 0 }}>
          <Avatar pk={event.pubkey} profiles={profiles} size={36} />
        </div>
        <div className="note-meta">
          <span className="note-name" style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
            {displayName(event.pubkey, profiles)}
          </span>
          <span className="note-npub">{nip05OrNpub(event.pubkey, profiles)}</span>
          <span className="meta-dot" aria-hidden="true">·</span>
          <span className="note-time">{relativeTime(event.created_at)}</span>
        </div>
        <button
          type="button"
          className="note-card-menu-btn"
          onClick={e => { e.stopPropagation(); setCardMenuOpen(v => !v); }}
          aria-label="More options"
        >
          <span /><span /><span />
        </button>
        {cardMenuOpen && (
          <NoteContextMenu
            event={event}
            onClose={() => setCardMenuOpen(false)}
            onViewJson={() => setJsonOpen(true)}
          />
        )}
      </div>

      <div className="cal-inner">
            {cal.image && (
              <img className="cal-cover-image" src={cal.image} alt={cal.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            )}
            <div className="cal-body">
              <div className="cal-title">{cal.title || "Untitled Event"}</div>
              {dateStr && <div className="cal-date-line">{dateStr}</div>}
              {location && (
                <div className="cal-meta-row">
                  <MapPin />
                  <span>{location}</span>
                </div>
              )}
              {cal.summary && (
                <div className="cal-summary">{cal.summary.slice(0, 120)}{cal.summary.length > 120 ? "…" : ""}</div>
              )}
              {cal.hashtags?.length ? (
                <div className="lf-hashtags">
                  {cal.hashtags.slice(0, 4).map(t => <span key={t}>#{t}</span>)}
                </div>
              ) : null}
            </div>
          </div>

          <NoteActions
            event={event}
            profiles={profiles}
            myPubkey={myPubkey}
            myProfile={myProfile}
            events={events}
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
          />
    </div>
    {jsonOpen && <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />}
    </>
  );
}
