import { Pi } from "./icons.jsx";
import { parseNoteMediaSegments } from "../utils.js";

function firstImageUrl(content) {
  const segs = parseNoteMediaSegments(content || "");
  return segs.find(s => s.type === "image")?.url ?? null;
}

export default function PinnedNotesCarousel({ events, onOpenThread }) {
  if (!events?.length) return null;

  return (
    <div className="pinned-carousel">
      <div className="pinned-carousel-header">
        <Pi s={11} />
        <span>Pinned</span>
      </div>
      <div className="pinned-carousel-track">
        {events.map(event => (
          <PinCard key={event.id} event={event} onOpenThread={onOpenThread} />
        ))}
      </div>
    </div>
  );
}

function PinCard({ event, onOpenThread }) {
  const imgUrl = firstImageUrl(event.content);

  return (
    <div className="pin-card" onClick={() => onOpenThread?.(event)}>
      {imgUrl && (
        <img
          className="pin-card-thumb"
          src={imgUrl}
          alt=""
          onError={e => { e.target.style.display = "none"; }}
        />
      )}
      <div className="pin-card-content">{event.content}</div>
    </div>
  );
}
