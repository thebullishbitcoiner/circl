import { useState, useMemo, useEffect } from "react";
import NoteText from "./NoteText.jsx";
import Avatar from "./Avatar.jsx";
import MediaLightbox from "./MediaLightbox.jsx";
import PollPreview from "./PollPreview.jsx";
import CalendarInlineCard from "./CalendarInlineCard.jsx";
import ZapGoalProgressBlock from "./ZapGoalProgressBlock.jsx";
import LightningCard from "./LightningCard.jsx";
import { parseNoteMediaSegments, groupNoteMediaSegments, displayName, relativeTime, nip19, isHexPubkey, normPubkey } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";
import { useNavigation } from "../context/NavigationContext.jsx";

// Deduplicate mention-profile fetches across all NoteContent instances
const _mentionFetched = new Set();

function fetchMentionedProfiles(content) {
  if (!content || typeof content !== "string") return;
  const refs = [...content.matchAll(/nostr:(?:npub1|nprofile1)[023456789acdefghjklmnpqrstuvwxyz]+/ig)];
  if (!refs.length) return;
  const pubkeys = refs.flatMap(m => {
    try {
      const d = nip19.decode(m[0].slice(6));
      if (d?.type === "npub") return [normPubkey(d.data)].filter(isHexPubkey);
      if (d?.type === "nprofile") return [normPubkey(d.data?.pubkey)].filter(isHexPubkey);
    } catch {}
    return [];
  });
  const toFetch = pubkeys.filter(pk => !_mentionFetched.has(pk));
  if (!toFetch.length) return;
  for (const pk of toFetch) _mentionFetched.add(pk);
  const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
  pool.request(relayUrls, [{ kinds: [0], authors: toFetch }]).subscribe({
    next: ev => eventStore.add(ev),
  });
}

function splitNostrEventRefs(text) {
  const out = [];
  const re = /nostr:(nevent1[023456789acdefghjklmnpqrstuvwxyz]+|note1[023456789acdefghjklmnpqrstuvwxyz]+)/ig;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    out.push({ type: "nevent", value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out.length ? out : [{ type: "text", value: text }];
}

function resolveNeventToId(nevent) {
  try {
    const d = nip19.decode(nevent);
    if (d?.type === "nevent" && d.data?.id) return d.data.id;
    if (d?.type === "note" && d.data) return d.data;
  } catch {}
  return null;
}

function decodeNevent(nevent) {
  try {
    const d = nip19.decode(nevent);
    if (d?.type === "nevent") return d.data;
    if (d?.type === "note") return { id: d.data };
  } catch {}
  return null;
}

function EmbeddedEvent({ event, profiles, onOpenProfile }) {
  const { onOpenThread, onOpenCalendarEvent, onOpenPoll, onOpenGoal } = useNavigation();
  if (!event) return null;
  const isPoll = event.kind === 1068 || event.kind === 6969;
  const isCalendar = event.kind === 31922 || event.kind === 31923;
  const isGoal = event.kind === 9041;
  const isZapPoll = event.kind === 6969;

  if (isCalendar) {
    return <CalendarInlineCard event={event} onOpen={onOpenCalendarEvent ?? onOpenThread} />;
  }

  if (isGoal) {
    return (
      <div className="note-embed" onClick={e => { e.stopPropagation(); (onOpenGoal ?? onOpenThread)?.(event); }} role="presentation">
        <div className="note-embed-head">
          <div onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} role="presentation">
            <Avatar pk={event.pubkey} profiles={profiles} size={20} />
          </div>
          <span className="note-embed-name" onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} role="presentation">
            {displayName(event.pubkey, profiles)}
          </span>
          <span className="zap-goal-badge" style={{ marginLeft: "auto" }}>⚡ Goal</span>
        </div>
        <NoteContent content={event.content || ""} tags={event.tags} profiles={profiles} allowEmbeds={false} className="note-embed-text" />
        <ZapGoalProgressBlock event={event} hideBadge />
      </div>
    );
  }

  return (
    <div
      className="note-embed"
      onClick={e => { e.stopPropagation(); (isPoll ? (onOpenPoll ?? onOpenThread) : onOpenThread)?.(event); }}
      role="presentation"
    >
      <div className="note-embed-head">
        <div onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} role="presentation">
          <Avatar pk={event.pubkey} profiles={profiles} size={20} />
        </div>
        <span
          className="note-embed-name"
          onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}
          role="presentation"
        >
          {displayName(event.pubkey, profiles)}
        </span>
        <span className="note-embed-time">{relativeTime(event.created_at)}</span>
        {isPoll && <span className="poll-badge" style={{ marginLeft: "auto" }}>{isZapPoll ? "⚡ Zap Poll" : "Poll"}</span>}
      </div>
      <NoteContent
        content={event.content || ""}
        tags={event.tags}
        profiles={profiles}
        onOpenProfile={onOpenProfile}
        allEvents={[]}
        onOpenThread={onOpenThread}
        allowEmbeds={false}
        className="note-embed-text"
        collapsible
      />
      {isPoll && <PollPreview event={event} />}
    </div>
  );
}

function EmbeddedEventRef({ nevent }) {
  const data = decodeNevent(nevent);
  if (!data?.id) return null;
  const shortId = `${data.id.slice(0, 12)}…${data.id.slice(-8)}`;
  const author = data.author ? `${data.author.slice(0, 10)}…${data.author.slice(-8)}` : null;
  return (
    <div className="note-embed note-embed-ref" role="presentation">
      <div className="note-embed-head">
        <span className="note-embed-name">Referenced note</span>
      </div>
      <div className="note-embed-text">
        <div>id: {shortId}</div>
        {author && <div>author: {author}</div>}
      </div>
    </div>
  );
}

function ImageMosaic({ urls, onImageClick }) {
  const c     = urls.length;
  const extra = c > 4 ? c - 4 : 0;
  const shown = extra ? urls.slice(0, 4) : urls;
  const layoutKey = c === 1 ? "one" : c === 2 ? "two" : c === 3 ? "three" : c === 4 ? "four" : "many";
  const cls = `note-mosaic note-mosaic-${layoutKey}`;

  return (
    <div className={cls} onClick={e => e.stopPropagation()}>
      {shown.map((url, i) => (
        <button
          key={`${url}-${i}`}
          type="button"
          className="note-mosaic-cell"
          onClick={e => {
            e.stopPropagation();
            onImageClick(i);
          }}
        >
          <img
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={e => {
              e.target.closest(".note-mosaic-cell")?.classList.add("note-mosaic-broken");
              e.target.style.display = "none";
            }}
          />
          {extra > 0 && i === 3 && (
            <span className="note-mosaic-more">+{extra}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// Renders a mixed image+video mosaic. items = [{ type: "image"|"video", url }]
function MediaMosaic({ items, onItemClick }) {
  const c = items.length;
  const extra = c > 4 ? c - 4 : 0;
  const shown = extra ? items.slice(0, 4) : items;
  const layoutKey = c === 1 ? "one" : c === 2 ? "two" : c === 3 ? "three" : c === 4 ? "four" : "many";

  return (
    <div className={`note-mosaic note-mosaic-${layoutKey}`} onClick={e => e.stopPropagation()}>
      {shown.map((item, i) => (
        <button
          key={`${item.url}-${i}`}
          type="button"
          className="note-mosaic-cell"
          onClick={e => { e.stopPropagation(); onItemClick(i); }}
        >
          {item.type === "video" ? (
            <>
              <video src={item.url} playsInline preload="metadata" muted />
              <span className="note-mosaic-play">
                <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36"><polygon points="5,3 19,12 5,21" /></svg>
              </span>
            </>
          ) : (
            <img
              src={item.url}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={e => {
                e.target.closest(".note-mosaic-cell")?.classList.add("note-mosaic-broken");
                e.target.style.display = "none";
              }}
            />
          )}
          {extra > 0 && i === 3 && <span className="note-mosaic-more">+{extra}</span>}
        </button>
      ))}
    </div>
  );
}

const COLLAPSE_THRESHOLD = 500;

/**
 * Renders note body with inline images (mosaic when multiple), videos, and @mentions.
 */
export default function NoteContent({
  content,
  tags,
  profiles,
  onOpenProfile,
  onOpenHashtag,
  allEvents = [],
  onOpenThread,
  resolveEventById,
  allowEmbeds = true,
  className = "note-text",
  style = {},
  collapsible = false,
}) {
  const segments = useMemo(
    () => groupNoteMediaSegments(parseNoteMediaSegments(content || "")),
    [content]
  );
  const normalizedSegments = useMemo(() => {
    const merged = [];
    for (const seg of segments) {
      const prev = merged[merged.length - 1];
      if (seg.type === "text" && prev?.type === "text") {
        prev.value = `${prev.value || ""}${seg.value || ""}`;
      } else {
        merged.push({ ...seg });
      }
    }
    return merged.map((seg, i) => {
      if (seg.type !== "text") return seg;
      let val = (seg.value || "").replace(/\n{3,}/g, "\n\n");
      const prev = merged[i - 1];
      const next = merged[i + 1];
      if (!prev || prev.type !== "text") val = val.replace(/^\n+/, "");
      if (!next || next.type !== "text") val = val.replace(/\n+$/, "");
      return { ...seg, value: val };
    }).filter(seg => seg.type !== "text" || (seg.value || "").trim() !== "");
  }, [segments]);

  const customEmojis = useMemo(() => {
    const map = {};
    for (const t of tags || []) {
      if (t[0] === "emoji" && t[1] && t[2]) map[t[1]] = t[2];
    }
    return map;
  }, [tags]);

  // Collect all media items in document order for bottom-mosaic layout
  const allMediaItems = useMemo(() => {
    const items = [];
    for (const seg of normalizedSegments) {
      if (seg.type === "images") {
        for (const url of seg.urls) items.push({ type: "image", url });
      } else if (seg.type === "video") {
        items.push({ type: "video", url: seg.url });
      }
    }
    return items;
  }, [normalizedSegments]);

  // When 2+ media items exist, hoist them all to a single mosaic at the bottom
  const hoistMedia = allMediaItems.length >= 2;

  const [lightbox, setLightbox] = useState(null);
  const [resolvedRefs, setResolvedRefs] = useState({});
  const [expanded, setExpanded] = useState(false);

  // Fetch profiles for any nprofile/npub mentions so display names resolve
  useEffect(() => { fetchMentionedProfiles(content); }, [content]);

  const textLength = normalizedSegments
    .filter(s => s.type === "text")
    .reduce((n, s) => {
      const stripped = (s.value || "").replace(/nostr:(nevent1|note1)[023456789acdefghjklmnpqrstuvwxyz]+/ig, "");
      return n + stripped.length;
    }, 0);
  const shouldCollapse = collapsible && textLength > COLLAPSE_THRESHOLD;
  const isCollapsed = shouldCollapse && !expanded;

  useEffect(() => {
    if (!allowEmbeds || !resolveEventById || typeof content !== "string" || !/nostr:(nevent1|note1)/i.test(content)) return;
    const refs = [...content.matchAll(/nostr:(nevent1[023456789acdefghjklmnpqrstuvwxyz]+|note1[023456789acdefghjklmnpqrstuvwxyz]+)/ig)]
      .map(m => m[1]);
    if (!refs.length) return;
    let cancelled = false;
    const known = new Set((allEvents || []).map(e => e.id));
    for (const nevent of refs) {
      const decoded = decodeNevent(nevent);
      const id = decoded?.id;
      const hints = decoded?.relays || [];
      if (!id || known.has(id) || resolvedRefs[id]) continue;
      Promise.resolve(resolveEventById(id, hints)).then(ev => {
        if (cancelled || !ev?.id) return;
        setResolvedRefs(prev => (prev[ev.id] ? prev : { ...prev, [ev.id]: ev }));
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [content, allEvents, resolveEventById, resolvedRefs, allowEmbeds]);

  // Collect all nevent/note1 refs from text segments — rendered at the bottom,
  // outside the collapse and after media, so they never block text or images.
  const embeddedRefs = useMemo(() => {
    if (!allowEmbeds) return [];
    const seen = new Set();
    const refs = [];
    for (const seg of normalizedSegments) {
      if (seg.type !== "text" || !seg.value) continue;
      for (const part of splitNostrEventRefs(seg.value)) {
        if (part.type === "nevent" && !seen.has(part.value)) {
          seen.add(part.value);
          refs.push(part.value);
        }
      }
    }
    return refs;
  }, [normalizedSegments, allowEmbeds]);

  const renderTextSegment = (seg, i) => {
    if (!seg.value || seg.value.trim() === "") return null;
    // Only render plain-text parts; nevent refs are lifted to bottom
    const textParts = splitNostrEventRefs(seg.value).filter(p => p.type === "text");
    return textParts.map((part, idx) => {
      if (!part.value) return null;
      return (
        <NoteText
          key={`${i}-t-${idx}`}
          content={part.value}
          profiles={profiles}
          onOpenProfile={onOpenProfile}
          onOpenHashtag={onOpenHashtag}
          customEmojis={customEmojis}
          className={className}
          style={style}
        />
      );
    });
  };

  return (
    <>
    <div className={`note-content-stack${isCollapsed ? " note-content-collapsed" : ""}`}>
      {normalizedSegments.map((seg, i) => {
        if (seg.type === "text") return renderTextSegment(seg, i);
        if (seg.type === "lightning") return <LightningCard key={i} value={seg.value} subtype={seg.subtype} />;
        return null;
      })}
      {isCollapsed && <div className="note-content-fade" />}
    </div>

    {shouldCollapse && (
      <button
        type="button"
        className="note-content-more-btn"
        onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
      >
        {expanded ? "Show less" : "Show more"}
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ transform: expanded ? "rotate(180deg)" : undefined, transition: "transform .2s" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    )}

    {hoistMedia ? (
      <MediaMosaic
        items={allMediaItems}
        onItemClick={idx => setLightbox({ items: allMediaItems, index: idx })}
      />
    ) : (
      normalizedSegments.map((seg, i) => {
        if (seg.type === "images" && seg.urls?.length) {
          return (
            <ImageMosaic
              key={i}
              urls={seg.urls}
              onImageClick={idx => setLightbox({ items: seg.urls.map(url => ({ type: "image", url })), index: idx })}
            />
          );
        }
        if (seg.type === "video") {
          return (
            <div
              key={i}
              className="note-media note-media-video"
              onClick={e => e.stopPropagation()}
            >
              <video src={seg.url} controls playsInline preload="metadata" />
            </div>
          );
        }
        return null;
      })
    )}

    {embeddedRefs.map((nevent, i) => {
      const id = resolveNeventToId(nevent);
      const refEvent = id ? (allEvents.find(e => e.id === id) || resolvedRefs[id]) : null;
      if (!refEvent) return <EmbeddedEventRef key={`bot-${i}`} nevent={nevent} />;
      return (
        <EmbeddedEvent
          key={`bot-${i}`}
          event={refEvent}
          profiles={profiles}
          onOpenProfile={onOpenProfile}
        />
      );
    })}

    {lightbox && (
      <MediaLightbox
        items={lightbox.items}
        index={lightbox.index}
        onClose={() => setLightbox(null)}
        onIndexChange={idx => setLightbox(l => (l ? { ...l, index: idx } : null))}
      />
    )}
    </>
  );
}
