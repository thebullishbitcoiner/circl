import * as nip19Lib from "nostr-tools/nip19";
import { decodeInvoice } from "@getalby/lightning-tools";
import {
  getCalendarEventTitle,
  getCalendarEventSummary,
  getCalendarEventImage,
  getCalendarEventStart,
  getCalendarEventEnd,
  getCalendarEventStartTimezone,
  getCalendarEventLocations,
  getCalendarEventHashtags,
} from "applesauce-common/helpers/calendar-event";
import {
  getStreamTitle,
  getStreamStatus,
  getStreamImage,
  getStreamHost,
  getStreamViewers,
  getStreamStreamingURLs,
  getStreamHashtags,
  getStreamSummary,
  getStreamStartTime,
} from "applesauce-common/helpers/stream";

/** Nostr hex pubkey: exactly 64 hex chars (NDK / nostr-tools validate this). */
export const isHexPubkey = pk =>
  typeof pk === "string" && /^[0-9a-fA-F]{64}$/.test(pk);

/** Lowercase hex pubkeys for consistent Map keys and nip19 (mixed case breaks profile lookup). */
export const normPubkey = pk => {
  if (typeof pk !== "string") return pk;
  return isHexPubkey(pk) ? pk.toLowerCase() : pk;
};

export const nip19 = {
  npubEncode:   pk    => nip19Lib.npubEncode(pk),
  noteEncode:   id    => nip19Lib.noteEncode(id),
  neventEncode: event => nip19Lib.neventEncode(event),
  decode:       str   => nip19Lib.decode(str),
};

export const truncNpub = pk => {
  const h = normPubkey(pk);
  try {
    const npub = nip19.npubEncode(h);
    return `${npub.slice(0, 11)}...${npub.slice(-11)}`;
  } catch { return (pk?.slice(0, 8) ?? "") + "…"; }
};

export const shortNpub = truncNpub;

export const nip05OrNpub = (pk, profiles) => {
  const k = normPubkey(pk);
  const nip05 = profiles?.[k]?.nip05;
  if (nip05) return nip05;
  return truncNpub(k);
};

export const relativeTime = ts => {
  const d = Math.floor(Date.now() / 1000) - ts;
  if (d < 60)     return `${d}s`;
  if (d < 3600)   return `${Math.floor(d / 60)}m`;
  if (d < 86400)  return `${Math.floor(d / 3600)}h`;
  if (d < 604800) return `${Math.floor(d / 86400)}d`;
  return new Date(ts * 1000).toLocaleDateString();
};

export const parseArticle = ev => {
  const get = n => ev.tags?.find(t => t[0] === n)?.[1] ?? null;
  const hashtags = (ev.tags || [])
    .filter(t => t[0] === "t" && t[1])
    .map(t => t[1]);
  const w   = ev.content?.split(/\s+/).length || 0;
  return {
    title:    get("title")   || "Untitled",
    summary:  get("summary") || ev.content?.slice(0, 160) + "…",
    tag:      get("t")       || "Article",
    hashtags,
    image:    get("image")   || "",
    readtime: `${Math.max(1, Math.ceil(w / 200))} min read`,
    dTag:     get("d")       || "",
  };
};

export function parseCalendarEvent(event) {
  const isDateBased = event.kind === 31922;
  const start = getCalendarEventStart(event);
  const end = getCalendarEventEnd(event);
  return {
    title: getCalendarEventTitle(event) ?? "",
    summary: getCalendarEventSummary(event) ?? event.content?.slice(0, 200) ?? "",
    image: getCalendarEventImage(event) ?? null,
    start,
    end,
    isDateBased,
    timezone: getCalendarEventStartTimezone(event) ?? null,
    locations: getCalendarEventLocations(event) ?? [],
    hashtags: getCalendarEventHashtags(event) ?? [],
    d: event.tags?.find(t => t[0] === "d")?.[1] ?? "",
  };
}

export function formatCalendarDate(start, end, isDateBased) {
  if (!start) return "";
  const startDate = new Date(start * 1000);
  const opts = isDateBased
    ? { month: "short", day: "numeric", year: "numeric" }
    : { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" };
  const startStr = startDate.toLocaleDateString(undefined, opts);
  if (!end || end === start) return startStr;
  const endDate = new Date(end * 1000);
  const endStr = endDate.toLocaleDateString(undefined, opts);
  return `${startStr} – ${endStr}`;
}

export const displayName = (pk, p) => {
  const k = normPubkey(pk);
  return p?.[k]?.display_name || p?.[k]?.name || shortNpub(k);
};
export const avatarInitial = (pk, p) => {
  const k = normPubkey(pk);
  const n = p?.[k]?.display_name || p?.[k]?.name;
  return n ? n[0].toUpperCase() : (k?.[0]?.toUpperCase() ?? "?");
};
export const avatarUrl = (pk, p) => {
  const k = normPubkey(pk);
  return p?.[k]?.picture || null;
};

export const fmtSatsVal = sats => {
  if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(1)}M`;
  if (sats >= 1_000)     return `${(sats / 1_000).toFixed(sats >= 10_000 ? 0 : 1)}k`;
  return String(sats);
};

export const fmtSats = msats => fmtSatsVal(Math.round(msats / 1000));

export const isQuoteRepost = e =>
  e?.kind === 1 && e.tags?.some(t => t[0] === "q");

export const directReplyParentId = event => {
  if (!event?.tags?.length) return null;
  const replyMark = event.tags.find(t => t[0] === "e" && t[3] === "reply");
  if (replyMark?.[1]) return replyMark[1];
  const roots = event.tags.filter(t => t[0] === "e" && t[3] === "root");
  const hasReply = event.tags.some(t => t[0] === "e" && t[3] === "reply");
  if (roots.length === 1 && !hasReply && roots[0][1]) return roots[0][1];
  const legacy = event.tags.filter(
    t => t[0] === "e" && t[3] !== "mention" && t[3] !== "quote"
  );
  if (legacy.length === 1 && legacy[0][1]) return legacy[0][1];
  // Positional convention (NIP-10 legacy): last e-tag = direct reply target
  if (legacy.length > 1) return legacy[legacy.length - 1][1];
  return null;
};

export const replyCount = (eventId, pool) =>
  pool.filter(e =>
    e.kind === 1 &&
    e.id !== eventId &&
    !isQuoteRepost(e) &&
    directReplyParentId(e) === eventId
  ).length;

export const repostAndQuoteCount = (eventId, pool) => {
  const kind6  = pool.filter(e =>
    e.kind === 6 && e.tags.some(t => t[0] === "e" && t[1] === eventId)
  ).length;
  const quotes = pool.filter(e =>
    e.kind === 1 && e.id !== eventId && e.tags.some(t => t[0] === "q" && t[1] === eventId)
  ).length;
  return kind6 + quotes;
};

/** Thread root note id for `replyTo` (walks parents in `pool` when markers are missing). */
export const threadRootId = (replyTo, pool = []) => {
  const marked = replyTo.tags?.find(t => t[0] === "e" && t[3] === "root")?.[1];
  if (marked) return marked;
  let cur = replyTo;
  const seen = new Set();
  while (cur) {
    if (seen.has(cur.id)) return replyTo.id;
    seen.add(cur.id);
    const pid = directReplyParentId(cur);
    if (!pid) return cur.id;
    const parent = pool.find(e => e.id === pid);
    if (!parent) return cur.id;
    cur = parent;
  }
  return replyTo.id;
};

/** NIP-10 marked `e` + `p` tags for publishing a reply (root / reply markers + mentions). */
export const replyTagsForPublish = (replyTo, pool = []) => {
  if (!replyTo?.id) return [];
  const rootId = threadRootId(replyTo, pool);
  const rootEv = pool.find(e => e.id === rootId);
  const eTags = [];
  if (rootId === replyTo.id) {
    eTags.push(["e", rootId, "", "root"]);
  } else {
    eTags.push(["e", rootId, "", "root"]);
    eTags.push(["e", replyTo.id, "", "reply"]);
  }
  const pPubkeys = new Set();
  if (replyTo.pubkey) pPubkeys.add(replyTo.pubkey);
  for (const t of replyTo.tags || []) {
    if (t[0] === "p" && t[1]) pPubkeys.add(t[1]);
  }
  if (rootId !== replyTo.id && rootEv?.pubkey) pPubkeys.add(rootEv.pubkey);
  const pTags = [...pPubkeys].map(pk => ["p", pk, "", "mention"]);
  return [...eTags, ...pTags];
};

export const buildParentChain = (event, pool, seen = new Set()) => {
  if (seen.has(event.id)) return [];
  seen.add(event.id);
  if (isQuoteRepost(event)) return [];
  const parentId = directReplyParentId(event);
  if (!parentId) return [];
  const parent = pool.find(e => e.id === parentId);
  if (!parent) return [];
  return [...buildParentChain(parent, pool, seen), parent];
};

export const buildSelfReplyChain = (event, pool, authorPk, seen = new Set()) => {
  if (seen.has(event.id)) return [];
  seen.add(event.id);
  const next = pool
    .filter(e => {
      if (e.kind !== 1 || e.pubkey !== authorPk || seen.has(e.id)) return false;
      if (!e.tags.some(t => t[0] === "e" && t[1] === event.id && t[3] !== "mention")) return false;
      if (isQuoteRepost(e)) return false;
      return e.tags.filter(t => t[0] === "p").every(t => t[1] === authorPk);
    })
    .sort((a, b) => a.created_at - b.created_at)[0];
  if (!next) return [];
  return [next, ...buildSelfReplyChain(next, pool, authorPk, seen)];
};

export const haptic = {
  tap:      () => navigator.vibrate?.(15),
  medium:   () => navigator.vibrate?.(30),
  heavy:    () => navigator.vibrate?.(50),
  longPress:() => navigator.vibrate?.([10, 40, 10]),
  zap:      () => navigator.vibrate?.([20, 30, 40]),
};

/** Millisatoshis decoded from a BOLT-11 invoice (Alby lightning-tools). */
export const parseBolt11Msats = bolt11 => {
  if (typeof bolt11 !== "string") return 0;
  const decoded = decodeInvoice(bolt11);
  const sats = decoded?.satoshi;
  if (!Number.isFinite(sats)) return 0;
  return Math.round(sats * 1000);
};

/** Kind 6 content often embeds the full reposted note as JSON (NIP-18). */
export function parseKind6EmbeddedEvent(e) {
  if (e?.kind !== 6 || typeof e.content !== "string") return null;
  const t = e.content.trim();
  if (!t.startsWith("{")) return null;
  try {
    const j = JSON.parse(t);
    if (j?.id && j?.pubkey && typeof j.kind === "number" && Array.isArray(j.tags)) return j;
  } catch {}
  return null;
}

/** Zap comment text from kind 9735 `description` tag (JSON). */
export function zapCommentFromKind9735(ev) {
  const desc = ev?.tags?.find(t => t[0] === "description")?.[1];
  if (!desc) return "";
  try {
    return String(JSON.parse(desc)?.content || "").trim();
  } catch {
    return "";
  }
}

/** Pubkey of the person who sent the zap (kind 9734 sender inside the kind 9735 receipt). */
export function zapperPubkeyFromKind9735(ev) {
  const desc = ev?.tags?.find(t => t[0] === "description")?.[1];
  if (!desc) return null;
  try {
    return JSON.parse(desc)?.pubkey ?? null;
  } catch {
    return null;
  }
}

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|avif|svg)(\?|#|$)/i;
const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;

/** Hosts that commonly serve images without a file extension in the path. */
const IMAGE_HOST_RE =
  /(pbs\.twimg\.com|imagedelivery\.net|nostr\.build|void\.cat|cdn\.void\.cat|i\.imgur\.com)/i;

export function trimMediaUrl(url) {
  if (!url || typeof url !== "string") return url;
  return url.replace(/[),.;:!?*»\]}]+$/, "");
}

/** @returns {"image"|"video"|null} */
export function classifyMediaUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  if (/imgur\.com\/(gallery|a)\//i.test(url)) return null;
  const path = url.split("?")[0].toLowerCase();
  if (IMAGE_EXT_RE.test(path)) return "image";
  if (VIDEO_EXT_RE.test(path)) return "video";
  if (IMAGE_HOST_RE.test(url)) return "image";
  return null;
}

/**
 * Split note body into text / image / video segments (plain https URLs and markdown ![…](url)).
 */
export function parseNoteMediaSegments(raw) {
  const input = (raw || "").replace(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi, (_, u) => trimMediaUrl(u));
  const segments = [];
  const re = /https?:\/\/[^\s<>'"]+/gi;
  let last = 0;
  let m;
  while ((m = re.exec(input)) !== null) {
    const rawUrl = m[0];
    const url    = trimMediaUrl(rawUrl);
    if (m.index > last) {
      const text = input.slice(last, m.index);
      if (text) segments.push({ type: "text", value: text });
    }
    const kind = classifyMediaUrl(url);
    if (kind === "image") segments.push({ type: "image", url });
    else if (kind === "video") segments.push({ type: "video", url });
    else segments.push({ type: "text", value: rawUrl });
    last = m.index + rawUrl.length;
  }
  if (last < input.length) {
    const rest = input.slice(last);
    if (rest) segments.push({ type: "text", value: rest });
  }
  if (!segments.length) segments.push({ type: "text", value: input });
  return segments;
}

export function parseStreamEvent(event) {
  return {
    title: getStreamTitle(event) ?? "",
    status: getStreamStatus(event),
    image: getStreamImage(event) ?? null,
    host: getStreamHost(event),
    viewers: getStreamViewers(event) ?? null,
    streamingURLs: getStreamStreamingURLs(event),
    hashtags: getStreamHashtags(event) ?? [],
    summary: getStreamSummary(event) ?? event.content?.slice(0, 200) ?? "",
    startTime: getStreamStartTime(event) ?? null,
    d: event.tags?.find(t => t[0] === "d")?.[1] ?? "",
  };
}

/**
 * Collapse consecutive image segments into one `{ type: "images", urls }` for mosaic + lightbox.
 * Whitespace-only text between URLs (common: one image per line) does not break the group.
 */
export function groupNoteMediaSegments(segments) {
  const out = [];
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    if (seg.type === "image") {
      const urls = [];
      while (i < segments.length) {
        const s = segments[i];
        if (s.type === "image") {
          urls.push(s.url);
          i++;
        } else if (s.type === "text" && s.value.trim() === "") {
          i++;
        } else {
          break;
        }
      }
      if (urls.length) out.push({ type: "images", urls });
    } else {
      out.push(seg);
      i++;
    }
  }
  return out;
}
