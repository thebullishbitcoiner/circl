import { useState, useEffect, useRef } from "react";
import Avatar from "./Avatar.jsx";
import ArticleBody from "./ArticleBody.jsx";
import NoteActions from "./NoteActions.jsx";
import { Bk } from "./icons.jsx";
import { displayName, nip05OrNpub, relativeTime, parseCalendarEvent, formatCalendarDate } from "../utils.js";
import useCalendarRSVPs from "../hooks/useCalendarRSVPs.js";
import { CalendarEventRSVPFactory } from "applesauce-common/factories/calendar-rsvp";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

const MapPin = ({ s = 14 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const CalendarIcon = ({ s = 14 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

export default function EventDetailView({
  event,
  profiles,
  pubkey,
  myProfile,
  events = [],
  publishEvent,
  onBack,
  onOpenProfile,
  onOpenThread,
  onOpenZaps,
  onOpenReactions,
  onOpenReposts,
  onPublish,
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
}) {
  const ref = useRef(null);
  const [rsvping, setRsvping] = useState(false);
  const [localMyRsvp, setLocalMyRsvp] = useState(null);

  const cal = parseCalendarEvent(event);
  const { counts, grouped, myRsvp, loading: rsvpLoading } = useCalendarRSVPs({ event, pubkey });
  const resolvedMyRsvp = localMyRsvp ?? myRsvp;

  // Fetch profiles for RSVP attendees that aren't already loaded
  useEffect(() => {
    const allPks = [...grouped.accepted, ...grouped.tentative, ...grouped.declined];
    if (!allPks.length) return;
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    pool.request(relayUrls, [{ kinds: [0], authors: allPks }]).subscribe({
      next: ev => eventStore.add(ev),
    });
  }, [grouped.accepted.join(","), grouped.tentative.join(","), grouped.declined.join(",")]);

  async function handleRsvp(status) {
    if (rsvping) return;
    setRsvping(true);
    try {
      const template = await CalendarEventRSVPFactory.create(event, status);
      await publishEvent(template);
      setLocalMyRsvp(status);
    } catch {}
    setRsvping(false);
  }

  const dateStr = formatCalendarDate(cal.start, cal.end, cal.isDateBased);

  return (
    <div ref={ref} className="slide-panel-scroll">
      <div className="panel-bar">
        <button className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span className="panel-bar-logo">Circl</span>
        <div style={{ display: "flex", gap: 3 }} />
      </div>

      <div className="reader-hero">
        {cal.image ? (
          <img className="reader-hero-image" src={cal.image} alt={cal.title} loading="eager" decoding="async" referrerPolicy="no-referrer" />
        ) : (
          <div className="reader-hero-glyph cal-hero-glyph">
            <CalendarIcon s={36} />
          </div>
        )}
      </div>

      <div className="reader-content">
        <div className="reader-header">
          <div className="reader-title">{cal.title || "Untitled Event"}</div>

          <div className="cal-detail-meta">
            {dateStr && (
              <div className="cal-detail-row">
                <CalendarIcon />
                <span>{dateStr}{cal.timezone ? ` (${cal.timezone})` : ""}</span>
              </div>
            )}
            {cal.locations.length > 0 && (
              <div className="cal-detail-row">
                <MapPin />
                <span>{cal.locations.join(", ")}</span>
              </div>
            )}
          </div>

          {cal.hashtags?.length ? (
            <div className="reader-hashtags">
              {cal.hashtags.map(t => <span key={t}>#{t}</span>)}
            </div>
          ) : null}

          <div className="reader-meta">
            <div className="r-author-row" onClick={() => onOpenProfile?.(event.pubkey)} style={{ cursor: "pointer" }}>
              <div className="r-av"><Avatar pk={event.pubkey} profiles={profiles} size={34} /></div>
              <div>
                <div className="r-author-name">{displayName(event.pubkey, profiles)}</div>
                <div className="r-author-npub">{nip05OrNpub(event.pubkey, profiles)}</div>
              </div>
            </div>
            <div className="meta-sep" />
            <span className="meta-pill">{relativeTime(event.created_at)} ago</span>
          </div>
        </div>

        {event.content?.trim() ? (
          <ArticleBody content={event.content} profiles={profiles} onOpenProfile={onOpenProfile} />
        ) : null}

        <div className="cal-detail-actions">
          <NoteActions
            event={event}
            profiles={profiles}
            myPubkey={pubkey}
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

        <div className="cal-rsvp-section">
          <div className="cal-rsvp-buttons">
            <button
              className={`cal-rsvp-btn ${resolvedMyRsvp === "accepted" ? "active accepted" : ""}`}
              onClick={() => handleRsvp("accepted")}
              disabled={rsvping}
            >Going</button>
            <button
              className={`cal-rsvp-btn ${resolvedMyRsvp === "tentative" ? "active tentative" : ""}`}
              onClick={() => handleRsvp("tentative")}
              disabled={rsvping}
            >Maybe</button>
            <button
              className={`cal-rsvp-btn ${resolvedMyRsvp === "declined" ? "active declined" : ""}`}
              onClick={() => handleRsvp("declined")}
              disabled={rsvping}
            >Can't go</button>
          </div>

          {grouped.accepted.length > 0 && (
            <AttendeeList label="Going" pubkeys={grouped.accepted} profiles={profiles} onOpenProfile={onOpenProfile} />
          )}
          {grouped.tentative.length > 0 && (
            <AttendeeList label="Maybe" pubkeys={grouped.tentative} profiles={profiles} onOpenProfile={onOpenProfile} />
          )}
          {grouped.declined.length > 0 && (
            <AttendeeList label="Can't go" pubkeys={grouped.declined} profiles={profiles} onOpenProfile={onOpenProfile} />
          )}
        </div>
      </div>
    </div>
  );
}

function AttendeeList({ label, pubkeys, profiles, onOpenProfile }) {
  return (
    <div className="cal-attendee-group">
      <div className="cal-attendee-label">{label} · {pubkeys.length}</div>
      {pubkeys.map(pk => (
        <div key={pk} className="cal-attendee-row" onClick={() => onOpenProfile?.(pk)}>
          <Avatar pk={pk} profiles={profiles} size={32} />
          <div className="cal-attendee-name">{displayName(pk, profiles)}</div>
        </div>
      ))}
    </div>
  );
}
