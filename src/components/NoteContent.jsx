import { useState, useMemo, useEffect } from "react";
import NoteText from "./NoteText.jsx";
import Avatar from "./Avatar.jsx";
import MediaLightbox from "./MediaLightbox.jsx";
import { parseNoteMediaSegments, groupNoteMediaSegments, displayName, relativeTime, nip19 } from "../utils.js";

function splitNostrEventRefs(text) {
  const out = [];
  const re = /nostr:(nevent1[023456789acdefghjklmnpqrstuvwxyz]+)/ig;
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
  } catch {}
  return null;
}

function decodeNevent(nevent) {
  try {
    const d = nip19.decode(nevent);
    return d?.type === "nevent" ? d.data : null;
  } catch {
    return null;
  }
}

function EmbeddedEvent({ event, profiles, onOpenProfile, onOpenThread }) {
  if (!event) return null;
  return (
    <div
      className="note-embed"
      onClick={e => { e.stopPropagation(); onOpenThread?.(event); }}
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
      </div>
      <NoteContent
        content={event.content || ""}
        profiles={profiles}
        onOpenProfile={onOpenProfile}
        allEvents={[]}
        onOpenThread={onOpenThread}
        allowEmbeds={false}
        className="note-embed-text"
      />
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

const COLLAPSE_THRESHOLD = 500;

/**
 * Renders note body with inline images (mosaic when multiple), videos, and @mentions.
 */
export default function NoteContent({
  content,
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

  const [lightbox, setLightbox] = useState(null);
  const [resolvedRefs, setResolvedRefs] = useState({});
  const [expanded, setExpanded] = useState(false);

  const shouldCollapse = collapsible && (content?.length ?? 0) > COLLAPSE_THRESHOLD;
  const isCollapsed = shouldCollapse && !expanded;

  useEffect(() => {
    if (!allowEmbeds || !resolveEventById || typeof content !== "string" || !content.includes("nostr:nevent1")) return;
    const refs = [...content.matchAll(/nostr:(nevent1[023456789acdefghjklmnpqrstuvwxyz]+)/ig)]
      .map(m => m[1]);
    if (!refs.length) return;
    let cancelled = false;
    const known = new Set((allEvents || []).map(e => e.id));
    for (const nevent of refs) {
      const id = resolveNeventToId(nevent);
      if (!id || known.has(id) || resolvedRefs[id]) continue;
      Promise.resolve(resolveEventById(id)).then(ev => {
        if (cancelled || !ev?.id) return;
        setResolvedRefs(prev => (prev[ev.id] ? prev : { ...prev, [ev.id]: ev }));
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [content, allEvents, resolveEventById, resolvedRefs, allowEmbeds]);

  return (
    <>
    <div className={`note-content-stack${isCollapsed ? " note-content-collapsed" : ""}`}>
      {normalizedSegments.map((seg, i) => {
        if (seg.type === "text") {
          if (!seg.value || seg.value.trim() === "") return null;
          const textParts = allowEmbeds ? splitNostrEventRefs(seg.value) : [{ type: "text", value: seg.value }];
          return textParts.map((part, idx) => {
            if (part.type === "text") {
              if (!part.value) return null;
              return (
                <NoteText
                  key={`${i}-t-${idx}`}
                  content={part.value}
                  profiles={profiles}
                  onOpenProfile={onOpenProfile}
                  onOpenHashtag={onOpenHashtag}
                  className={className}
                  style={style}
                />
              );
            }
            if (!allowEmbeds) return null;
            const id = resolveNeventToId(part.value);
            const refEvent = id ? (allEvents.find(e => e.id === id) || resolvedRefs[id]) : null;
            if (!refEvent) {
              return <EmbeddedEventRef key={`${i}-n-${idx}`} nevent={part.value} />;
            }
            return (
              <EmbeddedEvent
                key={`${i}-n-${idx}`}
                event={refEvent}
                profiles={profiles}
                onOpenProfile={onOpenProfile}
                onOpenThread={onOpenThread}
              />
            );
          });
        }
        if (seg.type === "images" && seg.urls?.length) {
          return (
            <ImageMosaic
              key={i}
              urls={seg.urls}
              onImageClick={idx => setLightbox({ urls: seg.urls, index: idx })}
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

    {lightbox && (
      <MediaLightbox
        urls={lightbox.urls}
        index={lightbox.index}
        onClose={() => setLightbox(null)}
        onIndexChange={idx => setLightbox(l => (l ? { ...l, index: idx } : null))}
      />
    )}
    </>
  );
}
