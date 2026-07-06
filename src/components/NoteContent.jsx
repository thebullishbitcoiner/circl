import { useState, useMemo, useEffect } from "react";
import NoteText from "./NoteText.jsx";
import Avatar from "./Avatar.jsx";
import MediaLightbox from "./MediaLightbox.jsx";
import PollPreview from "./PollPreview.jsx";
import CalendarInlineCard from "./CalendarInlineCard.jsx";
import ZapGoalProgressBlock from "./ZapGoalProgressBlock.jsx";
import LightningCard from "./LightningCard.jsx";
import { parseNoteMediaSegments, groupNoteMediaSegments, displayName, relativeTime, nip19, isHexPubkey, normPubkey, fmtSats, parseBolt11Msats, zapCommentFromKind9735, zapperPubkeyFromKind9735, firstLinkPreviewUrl, parseArticle } from "../utils.js";
import LinkPreviewCard from "./LinkPreviewCard.jsx";
import NoteAudioAttachment from "./NoteAudioAttachment.jsx";
import PodcastPreviewChip from "./PodcastPreviewChip.jsx";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";
import { useNavigation } from "../context/NavigationContext.jsx";
import useContentSettings from "../hooks/useContentSettings.js";

function ZapEmbed({ event, profiles, onOpenProfile }) {
  const [liveEvent, setLiveEvent]     = useState(null);
  const [podcastMeta, setPodcastMeta] = useState(null);

  const zapperPk    = zapperPubkeyFromKind9735(event) ?? event.tags?.find(t => t[0] === "P")?.[1] ?? null;
  const recipientPk = event.tags?.find(t => t[0] === "p")?.[1] ?? null;
  const msats       = parseBolt11Msats(event.tags?.find(t => t[0] === "bolt11")?.[1]);
  const comment     = zapCommentFromKind9735(event);
  const items       = event.tags?.filter(t => t[0] === "i" && typeof t[1] === "string") ?? [];
  const episode     = items.find(t => t[1]?.startsWith("podcast:item:guid:"));
  const show        = items.find(t => t[1]?.startsWith("podcast:guid:"));
  const publisher   = items.find(t => t[1]?.startsWith("podcast:publisher:guid:"));
  const isPodcast   = !!(episode || show || publisher);
  const linkUrl     = episode?.[2] ?? show?.[2] ?? publisher?.[2] ?? null;
  const podLabel    = episode ? "episode" : show ? "podcast" : "publisher";

  const aTagVal = event.tags?.find(t => t[0] === "a")?.[1] ?? null;
  useEffect(() => {
    if (!aTagVal) return;
    const [kindStr, evPubkey, dTag] = aTagVal.split(":");
    if (kindStr !== "30311" || !evPubkey || !dTag) return;
    const cached = eventStore.getTimeline([{ kinds: [30311], authors: [evPubkey], "#d": [dTag], limit: 1 }])?.[0];
    if (cached) { setLiveEvent(cached); return; }
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    const sub = pool.request(relayUrls, [{ kinds: [30311], authors: [evPubkey], "#d": [dTag], limit: 1 }]).subscribe({
      next: ev => { eventStore.add(ev); setLiveEvent(ev); },
    });
    return () => sub.unsubscribe();
  }, [aTagVal]);

  useEffect(() => {
    if (!linkUrl) return;
    import("../utils/linkPreview.js").then(m => m.fetchLinkPreview(linkUrl)).then(d => { if (d) setPodcastMeta(d); });
  }, [linkUrl]);

  const stripPodcastSuffix = t => t.replace(/\s*•\s*(Watch|Listen|Play|Stream) on \S+\s*$/i, "").trim();
  const liveTitle    = liveEvent?.tags?.find(t => t[0] === "title")?.[1] ?? null;
  const podcastTitle = podcastMeta?.title ? stripPodcastSuffix(podcastMeta.title) : null;
  const hasTarget    = isPodcast || !!liveTitle;

  return (
    <div className="note-embed note-embed-ref" role="presentation">
      <div className="note-embed-head">
        <div role="presentation" onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}><Avatar pk={event.pubkey} profiles={profiles} size={20} /></div>
        <span className="note-embed-name" role="presentation" onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
          {displayName(event.pubkey, profiles)}
        </span>
        <span className="note-embed-time">{relativeTime(event.created_at)}</span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.4, marginBottom: (comment || isPodcast) ? 6 : 0 }}>
        <span className="ix-mention" style={{ cursor: zapperPk ? "pointer" : "default" }} role="presentation" onClick={e => { e.stopPropagation(); zapperPk && onOpenProfile?.(zapperPk); }}>
          @{zapperPk ? displayName(zapperPk, profiles) : "Anonymous"}
        </span>
        {" "}<span style={{ color: "var(--text-faint)" }}>zapped</span>{" "}
        <span style={{ fontWeight: 600, color: "#f59e0b" }}>⚡ {fmtSats(msats)}</span>
        {hasTarget && (
          <>{" "}<span style={{ color: "var(--text-faint)" }}>to</span>{" "}
          {liveTitle ? (
            <span style={{ fontWeight: 500 }}><span className="live-badge">Live</span>{liveTitle}</span>
          ) : (
            <span style={{ fontWeight: 500 }}>{podcastTitle ?? podLabel}</span>
          )}
          </>
        )}
      </div>
      {comment && <NoteText content={`"${comment}"`} profiles={profiles} onOpenProfile={onOpenProfile} style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic", marginBottom: isPodcast ? 6 : 0 }} />}
      {isPodcast && <PodcastPreviewChip url={linkUrl} fallbackLabel={podLabel} />}
    </div>
  );
}

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
  const re = /nostr:(naddr1[023456789acdefghjklmnpqrstuvwxyz]+|nevent1[023456789acdefghjklmnpqrstuvwxyz]+|note1[023456789acdefghjklmnpqrstuvwxyz]+)/ig;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    const val = m[1];
    const type = val.startsWith("naddr1") ? "naddr" : "nevent";
    out.push({ type, value: val });
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

function decodeNaddr(naddr) {
  try {
    const d = nip19.decode(naddr);
    if (d?.type === "naddr") return d.data; // { kind, pubkey, identifier, relays }
  } catch {}
  return null;
}

function EmbeddedEvent({ event, profiles, onOpenProfile }) {
  const { onOpenThread, onOpenCalendarEvent, onOpenPoll, onOpenGoal, onOpenArticle } = useNavigation();
  if (!event) return null;
  const isPoll = event.kind === 1068 || event.kind === 6969;
  const isCalendar = event.kind === 31922 || event.kind === 31923;
  const isGoal = event.kind === 9041;
  const isZapPoll = event.kind === 6969;

  if (event.kind === 30023) {
    const art = parseArticle(event);
    return (
      <div
        className="lf-inner"
        style={{ cursor: "pointer", marginTop: 8 }}
        onClick={e => { e.stopPropagation(); onOpenArticle?.(event); }}
        role="presentation"
      >
        {art.image ? (
          <img className="lf-image" src={art.image} alt={art.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        ) : (
          <div className="lf-placeholder">✦</div>
        )}
        <div className="lf-body">
          <div className="note-embed-head" style={{ marginBottom: 4 }}>
            <div onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} role="presentation">
              <Avatar pk={event.pubkey} profiles={profiles} size={16} />
            </div>
            <span className="note-embed-name" onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} role="presentation">
              {displayName(event.pubkey, profiles)}
            </span>
            <span className="note-embed-time">{relativeTime(event.created_at)}</span>
          </div>
          <div className="lf-title">{art.title}</div>
          {art.summary && <div className="lf-summary">{art.summary}</div>}
        </div>
      </div>
    );
  }

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

  if (event.kind === 9735) {
    return <ZapEmbed event={event} profiles={profiles} onOpenProfile={onOpenProfile} />;
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

function EmbeddedNaddrRef({ naddr }) {
  const data = decodeNaddr(naddr);
  if (!data) return null;
  const kindLabel = data.kind === 30023 ? "Article" : data.kind === 30030 ? "Emoji Pack" : `Kind ${data.kind}`;
  return (
    <div className="note-embed note-embed-ref" role="presentation">
      <div className="note-embed-head">
        <span className="note-embed-name">Referenced {kindLabel}</span>
      </div>
      {data.identifier && <div className="note-embed-text">{data.identifier}</div>}
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
  const [resolvedNaddrRefs, setResolvedNaddrRefs] = useState({});
  const [expanded, setExpanded] = useState(false);
  const { autoplayVideos, loopVideos } = useContentSettings();

  // Fetch profiles for any nprofile/npub mentions so display names resolve
  useEffect(() => { fetchMentionedProfiles(content); }, [content]);

  const textLength = normalizedSegments
    .filter(s => s.type === "text")
    .reduce((n, s) => {
      const stripped = (s.value || "").replace(/nostr:(naddr1|nevent1|note1)[023456789acdefghjklmnpqrstuvwxyz]+/ig, "");
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

  useEffect(() => {
    if (!allowEmbeds || typeof content !== "string" || !/nostr:naddr1/i.test(content)) return;
    const refs = [...content.matchAll(/nostr:(naddr1[023456789acdefghjklmnpqrstuvwxyz]+)/ig)].map(m => m[1]);
    if (!refs.length) return;
    let cancelled = false;
    const connected = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    for (const naddr of refs) {
      if (resolvedNaddrRefs[naddr]) continue;
      const data = decodeNaddr(naddr);
      if (!data) continue;
      const filter = { kinds: [data.kind], authors: [data.pubkey], limit: 1 };
      if (data.identifier) filter["#d"] = [data.identifier];
      const relayUrls = data.relays?.length ? [...new Set([...data.relays, ...connected])] : connected;
      pool.request(relayUrls, [filter]).subscribe({
        next: ev => {
          if (cancelled || !ev?.id) return;
          eventStore.add(ev);
          setResolvedNaddrRefs(prev => (prev[naddr] ? prev : { ...prev, [naddr]: ev }));
        },
      });
    }
    return () => { cancelled = true; };
  }, [content, resolvedNaddrRefs, allowEmbeds]);

  // Collect all nevent/note1/naddr1 refs from text segments — rendered at the bottom,
  // outside the collapse and after media, so they never block text or images.
  const embeddedRefs = useMemo(() => {
    if (!allowEmbeds) return [];
    const seen = new Set();
    const refs = [];
    for (const seg of normalizedSegments) {
      if (seg.type !== "text" || !seg.value) continue;
      for (const part of splitNostrEventRefs(seg.value)) {
        if ((part.type === "nevent" || part.type === "naddr") && !seen.has(part.value)) {
          seen.add(part.value);
          refs.push(part);
        }
      }
    }
    return refs;
  }, [normalizedSegments, allowEmbeds]);

  const renderTextSegment = (seg, i) => {
    if (!seg.value || seg.value.trim() === "") return null;
    // Only render plain-text parts; nevent/naddr refs are lifted to bottom
    const allParts = splitNostrEventRefs(seg.value);
    const textParts = allParts.map((part, idx) => {
      if (part.type !== "text") return part;
      let val = part.value;
      // Trim newlines adjacent to entity refs — otherwise the blank lines
      // that surrounded the nostr: URI remain as visible whitespace (pre-wrap).
      if (idx < allParts.length - 1 && allParts[idx + 1].type !== "text")
        val = val.replace(/\n+$/, "");
      if (idx > 0 && allParts[idx - 1].type !== "text")
        val = val.replace(/^\n+/, "");
      return { ...part, value: val };
    }).filter(p => p.type === "text");
    return textParts.map((part, idx) => {
      if (!part.value || !part.value.trim()) return null;
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
              <video src={seg.url} controls playsInline preload="metadata" autoPlay={autoplayVideos} muted={autoplayVideos} loop={loopVideos} />
            </div>
          );
        }
        return null;
      })
    )}

    {normalizedSegments.filter(s => s.type === "audio").map((seg, i) => (
      <NoteAudioAttachment key={seg.url || i} url={seg.url} platform={seg.platform} />
    ))}

    {embeddedRefs.map((ref, i) => {
      if (ref.type === "naddr") {
        const refEvent = resolvedNaddrRefs[ref.value];
        if (!refEvent) return <EmbeddedNaddrRef key={`bot-${i}`} naddr={ref.value} />;
        return <EmbeddedEvent key={`bot-${i}`} event={refEvent} profiles={profiles} onOpenProfile={onOpenProfile} />;
      }
      const id = resolveNeventToId(ref.value);
      const refEvent = id ? (allEvents.find(e => e.id === id) || resolvedRefs[id]) : null;
      if (!refEvent) return <EmbeddedEventRef key={`bot-${i}`} nevent={ref.value} />;
      return (
        <EmbeddedEvent
          key={`bot-${i}`}
          event={refEvent}
          profiles={profiles}
          onOpenProfile={onOpenProfile}
        />
      );
    })}

    {allowEmbeds && (() => { const u = firstLinkPreviewUrl(content); return u ? <LinkPreviewCard key={u} url={u} /> : null; })()}

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
