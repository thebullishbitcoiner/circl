import { nip19, displayName } from "../utils.js";

function toHref(raw) {
  if (typeof raw !== "string" || !raw) return null;
  const val = raw.startsWith("www.") ? `https://${raw}` : raw;
  try {
    const u = new URL(val);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function splitTrailingPunctuation(token) {
  const m = token.match(/^(.*?)([),.!?:;]+)?$/);
  if (!m) return [token, ""];
  return [m[1], m[2] || ""];
}

const NPUB_RE = /^(?:nostr:)?(npub1[a-z0-9]{6,})$/i;

function decodeNpub(token) {
  const m = token.match(NPUB_RE);
  if (!m) return null;
  try {
    const { type, data } = nip19.decode(m[1]);
    return type === "npub" ? data : null;
  } catch {
    return null;
  }
}

export default function ProfileText({ text, className = "", style, clampLines, profiles, onOpenProfile }) {
  if (!text) return null;
  const lines = String(text).split("\n");
  return (
    <div
      className={`profile-richtext ${className}`.trim()}
      style={{
        ...style,
        ...(clampLines
          ? {
              display: "-webkit-box",
              WebkitLineClamp: clampLines,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }
          : {}),
      }}
    >
      {lines.map((line, lineIdx) => {
        const parts = line.split(/(\s+)/);
        return (
          <span key={lineIdx}>
            {parts.map((part, idx) => {
              const [core, trailing] = splitTrailingPunctuation(part);

              const pubkey = decodeNpub(core);
              if (pubkey) {
                const name = displayName(pubkey, profiles);
                return (
                  <span key={`${lineIdx}-${idx}`}>
                    <span
                      className="note-mention"
                      style={{ cursor: onOpenProfile ? "pointer" : undefined }}
                      onClick={onOpenProfile ? e => { e.stopPropagation(); onOpenProfile(pubkey); } : undefined}
                    >
                      @{name}
                    </span>
                    {trailing}
                  </span>
                );
              }

              const href = toHref(core);
              if (href) {
                return (
                  <span key={`${lineIdx}-${idx}`}>
                    <a href={href} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                      {core}
                    </a>
                    {trailing}
                  </span>
                );
              }

              return <span key={`${lineIdx}-${idx}`}>{part}</span>;
            })}
            {lineIdx < lines.length - 1 ? <br /> : null}
          </span>
        );
      })}
    </div>
  );
}
