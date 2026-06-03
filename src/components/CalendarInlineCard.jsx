import { parseCalendarEvent, formatCalendarDate } from "../utils.js";

const MapPin = () => (
  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

export default function CalendarInlineCard({ event, onOpen }) {
  const cal = parseCalendarEvent(event);
  const dateStr = formatCalendarDate(cal.start, cal.end, cal.isDateBased);
  const location = cal.locations[0] ?? null;
  return (
    <div className="cal-inner" style={{ marginBottom: 6 }} onClick={e => { e.stopPropagation(); onOpen?.(event); }}>
      {cal.image && <img className="cal-cover-image" src={cal.image} alt={cal.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
      <div className="cal-body">
        <div className="cal-title">{cal.title || "Untitled Event"}</div>
        {dateStr && <div className="cal-date-line">{dateStr}</div>}
        {location && <div className="cal-meta-row"><MapPin /><span>{location}</span></div>}
        {cal.summary && <div className="cal-summary">{cal.summary.slice(0, 120)}{cal.summary.length > 120 ? "…" : ""}</div>}
      </div>
    </div>
  );
}
