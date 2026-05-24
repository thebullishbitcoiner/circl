import { displayName, nip19 } from "../utils.js";

function trimUrlToken(url) {
  return url.replace(/[),.;:!?*»\]}]+$/, "");
}

export default function NoteText({ content, profiles, onOpenProfile, onOpenHashtag, className = "note-text", style = {} }) {
  const parts = content.split(/(https?:\/\/[^\s<>'"]+|nostr:(?:npub1|nprofile1)[023456789acdefghjklmnpqrstuvwxyz]+|#[a-zA-Z][a-zA-Z0-9_]+|@\S+)/gi);

  const handleMention = mention => {
    if (!onOpenProfile) return;
    const handle = mention.slice(1).toLowerCase();
    const match  = Object.entries(profiles || {}).find(([, p]) =>
      p.name?.toLowerCase() === handle ||
      p.name?.toLowerCase().replace(/\s+/g, "") === handle
    );
    if (match) onOpenProfile(match[0]);
  };

  return (
    <p className={className} style={style}>
      {parts.map((part, i) => {
        if (!part) return null;
        if (/^#[a-zA-Z][a-zA-Z0-9_]+$/.test(part)) {
          const tag = part.slice(1);
          return (
            <span key={i} className="note-hashtag" onClick={e => { e.stopPropagation(); onOpenHashtag?.(tag); }}>
              {part}
            </span>
          );
        }
        if (part.startsWith("@")) {
          return (
            <span key={i} className="ix-mention" style={{ cursor: "pointer" }}
              onClick={e => { e.stopPropagation(); handleMention(part); }}>
              {part}
            </span>
          );
        }
        if (/^https?:\/\//i.test(part)) {
          const href = trimUrlToken(part);
          return (
            <a
              key={i}
              className="note-link"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
            >
              {href}
            </a>
          );
        }
        if (/^nostr:(npub1|nprofile1)/i.test(part)) {
          let pk = null;
          try {
            const d = nip19.decode(part.slice(6));
            if (d?.type === "npub") pk = d.data;
            if (d?.type === "nprofile") pk = d.data?.pubkey || null;
          } catch {}
          if (!pk) return part;
          return (
            <span
              key={i}
              className="ix-mention"
              style={{ cursor: "pointer" }}
              onClick={e => { e.stopPropagation(); onOpenProfile?.(pk); }}
            >
              @{displayName(pk, profiles)}
            </span>
          );
        }
        return part;
      })}
    </p>
  );
}
