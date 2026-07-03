import { Pi } from "./icons.jsx";
import { parseNoteMediaSegments, relativeTime, nip19, displayName } from "../utils.js";

function firstImageUrl(content) {
  const segs = parseNoteMediaSegments(content || "");
  return segs.find(s => s.type === "image")?.url ?? null;
}

const NOSTR_MENTION_RE = /nostr:(?:npub1|nprofile1)[023456789acdefghjklmnpqrstuvwxyz]+/gi;

function renderCardText(content, profiles) {
  const parts = content.split(NOSTR_MENTION_RE);
  const matches = [...content.matchAll(NOSTR_MENTION_RE)];
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) out.push(parts[i]);
    const m = matches[i];
    if (!m) continue;
    let pk = null;
    try {
      const d = nip19.decode(m[0].slice(6));
      pk = d?.type === "npub" ? d.data : d?.type === "nprofile" ? d.data?.pubkey : null;
    } catch {}
    out.push(
      <span key={i} className="ix-mention">
        @{pk ? displayName(pk, profiles) : m[0].slice(6, 14) + "…"}
      </span>
    );
  }
  return out;
}

export default function PinnedNotesCarousel({ events, profiles, onOpenThread }) {
  if (!events?.length) return null;

  return (
    <div className="pinned-carousel">
      <div className="pinned-carousel-header">
        <Pi s={11} />
        <span>Pinned</span>
      </div>
      <div
        className="pinned-carousel-track"
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        {events.map(event => (
          <PinCard key={event.id} event={event} profiles={profiles} onOpenThread={onOpenThread} />
        ))}
      </div>
    </div>
  );
}

function PinCard({ event, profiles, onOpenThread }) {
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
      <div className="pin-card-body">
        <div className="pin-card-time">{relativeTime(event.created_at)}</div>
        <div className="pin-card-content">{renderCardText(event.content, profiles)}</div>
      </div>
    </div>
  );
}
