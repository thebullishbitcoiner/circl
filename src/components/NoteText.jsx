import { Fragment } from "react";
import { displayName, nip19 } from "../utils.js";

function trimUrlToken(url) {
  return url.replace(/(?:[),.;:!?*»\]}]|[^\x00-\x7F])+$/, "");
}

// Tries to decode a nostr bech32 string (without the "nostr:" prefix), tolerating
// trailing chars absorbed by the greedy split regex (e.g. "nd" from "and").
// Returns { pk, trailing } or null if undecodable.
function decodeNostrRef(raw) {
  const maxTrim = Math.min(8, raw.length - 10);
  for (let trim = 0; trim <= maxTrim; trim++) {
    const attempt = trim === 0 ? raw : raw.slice(0, -trim);
    try {
      const d = nip19.decode(attempt);
      if (d?.type === "npub" && d.data)
        return { pk: d.data, trailing: trim > 0 ? raw.slice(-trim) : "" };
      if (d?.type === "nprofile" && d.data?.pubkey)
        return { pk: d.data.pubkey, trailing: trim > 0 ? raw.slice(-trim) : "" };
    } catch {}
  }
  return null;
}

// Matches garbage left behind when the bech32 regex stops at a non-bech32 char that
// was actually part of a corrupted nostr entity HRP (e.g. "ofile1qqs8…" from a
// mangled "nprofile1qqs8…"). Pattern: up to 12 non-whitespace non-separator chars,
// then "1" (bech32 separator), then 30+ bech32 data chars.
const BECH32_GARBAGE_RE = /^[^\s1]{0,12}1[023456789acdefghjklmnpqrstuvwxyz]{30,}/;

// Order matters: ***bold-italic*** before **bold** before *italic*, all before single *.
// Excludes newlines and delimiter chars inside spans to prevent runaway matches.
const INLINE_MD_RE = /(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|~~[^~\n]+~~|`[^`\n]+`|\*[^*\n]+\*)/g;

function applyInlineMarkdown(text, keyPrefix) {
  const parts = [];
  let last = 0;
  const re = new RegExp(INLINE_MD_RE.source, "g");
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${keyPrefix}-md-${m.index}`;
    if (token.startsWith("***")) {
      parts.push(<strong key={key}><em>{token.slice(3, -3)}</em></strong>);
    } else if (token.startsWith("**")) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~")) {
      parts.push(<del key={key}>{token.slice(2, -2)}</del>);
    } else if (token.startsWith("`")) {
      parts.push(<code key={key} className="note-code">{token.slice(1, -1)}</code>);
    } else {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function NoteText({ content, profiles, onOpenProfile, onOpenHashtag, customEmojis, className = "note-text", style = {} }) {
  const parts = content.split(/(https?:\/\/[^\s<>'"]+|nostr:(?:npub1|nprofile1)[023456789acdefghjklmnpqrstuvwxyz]+|#[a-zA-Z0-9][a-zA-Z0-9_]+|@\S+|:[a-zA-Z0-9_]+:)/gi);

  const handleMention = mention => {
    if (!onOpenProfile) return;
    const handle = mention.slice(1).toLowerCase();
    const match = Object.entries(profiles || {}).find(([, p]) =>
      p.name?.toLowerCase() === handle ||
      p.name?.toLowerCase().replace(/\s+/g, "") === handle
    );
    if (match) onOpenProfile(match[0]);
  };

  const elements = [];
  let prevWasDecodedNostr = false;

  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    if (!part) { prevWasDecodedNostr = false; continue; }

    if (/^#[a-zA-Z0-9][a-zA-Z0-9_]+$/.test(part)) {
      const tag = part.slice(1);
      elements.push(
        <span key={i} className="note-hashtag" onClick={e => { e.stopPropagation(); onOpenHashtag?.(tag); }}>
          {part}
        </span>
      );
      prevWasDecodedNostr = false;

    } else if (part.startsWith("@")) {
      elements.push(
        <span key={i} className="ix-mention" style={{ cursor: "pointer" }}
          onClick={e => { e.stopPropagation(); handleMention(part); }}>
          {part}
        </span>
      );
      prevWasDecodedNostr = false;

    } else if (/^:[a-zA-Z0-9_]+:$/.test(part)) {
      const name = part.slice(1, -1);
      const url = customEmojis?.[name];
      if (url) {
        elements.push(
          <img key={i} src={url} alt={part} className="note-custom-emoji" />
        );
      } else {
        elements.push(part);
      }
      prevWasDecodedNostr = false;

    } else if (/^https?:\/\//i.test(part)) {
      const href = trimUrlToken(part);
      elements.push(
        <a key={i} className="note-link" href={href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
          {href}
        </a>
      );
      prevWasDecodedNostr = false;

    } else if (/^nostr:(npub1|nprofile1)/i.test(part)) {
      const decoded = decodeNostrRef(part.slice(6));
      if (decoded) {
        const { pk, trailing } = decoded;
        elements.push(
          <Fragment key={i}>
            <span
              className="ix-mention"
              style={{ cursor: "pointer" }}
              onClick={e => { e.stopPropagation(); onOpenProfile?.(pk); }}
            >
              @{displayName(pk, profiles)}
            </span>
            {trailing}
          </Fragment>
        );
        prevWasDecodedNostr = true;
      } else {
        elements.push(part);
        prevWasDecodedNostr = false;
      }

    } else {
      // Plain text. Strip bech32 garbage that immediately follows a decoded nostr entity —
      // it's the leftover HRP tail from a corrupted/concatenated nostr: URI.
      if (prevWasDecodedNostr) {
        part = part.replace(BECH32_GARBAGE_RE, "");
      }
      if (part) elements.push(...applyInlineMarkdown(part, i));
      prevWasDecodedNostr = false;
    }
  }

  return <p className={className} style={style}>{elements}</p>;
}
