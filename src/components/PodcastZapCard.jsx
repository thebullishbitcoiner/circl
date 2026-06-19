import { useState, useEffect } from "react";
import Avatar from "./Avatar.jsx";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import PodcastPreviewChip from "./PodcastPreviewChip.jsx";
import { displayName, relativeTime, fmtSats, parseBolt11Msats, zapCommentFromKind9735, zapperPubkeyFromKind9735 } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

function podcastInfo(ev) {
  const items     = ev.tags?.filter(t => t[0] === "i" && typeof t[1] === "string") ?? [];
  const episode   = items.find(t => t[1].startsWith("podcast:item:guid:"));
  const show      = items.find(t => t[1].startsWith("podcast:guid:"));
  const publisher = items.find(t => t[1].startsWith("podcast:publisher:guid:"));
  const isPodcast = !!(episode || show || publisher);
  const linkUrl   = episode?.[2] ?? show?.[2] ?? publisher?.[2] ?? null;
  const label     = episode ? "episode" : show ? "podcast" : "publisher";
  return { isPodcast, linkUrl, label };
}

export default function PodcastZapCard({ event, profiles, onOpenProfile, onOpenStream, delay = 0 }) {
  const [menuOpen, setMenuOpen]     = useState(false);
  const [jsonOpen, setJsonOpen]     = useState(false);
  const [liveEvent, setLiveEvent]   = useState(null);

  const zapperPk    = zapperPubkeyFromKind9735(event) ?? event.tags?.find(t => t[0] === "P")?.[1] ?? null;
  const recipientPk = event.tags?.find(t => t[0] === "p")?.[1] ?? null;
  const msats       = parseBolt11Msats(event.tags?.find(t => t[0] === "bolt11")?.[1]);
  const comment     = zapCommentFromKind9735(event);
  const { isPodcast, linkUrl, label } = podcastInfo(event);
  const showRecipient = recipientPk && recipientPk !== zapperPk;

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

  return (
    <>
      <div
        className="note-card"
        style={{ animationDelay: `${delay}s`, zIndex: menuOpen ? 1 : undefined }}
      >
        <div className="note-header">
          <div
            style={{ cursor: zapperPk ? "pointer" : "default", flexShrink: 0 }}
            onClick={e => { if (!zapperPk) return; e.stopPropagation(); onOpenProfile?.(zapperPk); }}
          >
            <Avatar pk={zapperPk} profiles={profiles} size={36} />
          </div>
          <div className="note-meta">
            <span
              className="note-name"
              style={{ cursor: zapperPk ? "pointer" : "default" }}
              onClick={e => { if (!zapperPk) return; e.stopPropagation(); onOpenProfile?.(zapperPk); }}
            >
              {zapperPk ? displayName(zapperPk, profiles) : "Anonymous"}
            </span>
            <span className="meta-dot" aria-hidden="true">·</span>
            <span className="note-time">{relativeTime(event.created_at)}</span>
          </div>
          <button
            type="button"
            className="note-card-menu-btn"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            aria-label="More options"
          >
            <span /><span /><span />
          </button>
          {menuOpen && (
            <NoteContextMenu event={event} onClose={() => setMenuOpen(false)} onViewJson={() => { setJsonOpen(true); setMenuOpen(false); }} />
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: (comment || isPodcast || liveEvent) ? 8 : 0 }}>
          <span style={{ fontSize: 14, color: "var(--text-faint)" }}>zapped</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#f59e0b" }}>⚡ {fmtSats(msats)}</span>
          {showRecipient && (
            <>
              <span style={{ fontSize: 13, color: "var(--text-faint)" }}>to</span>
              <span
                style={{ fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                onClick={e => { e.stopPropagation(); onOpenProfile?.(recipientPk); }}
              >
                {displayName(recipientPk, profiles)}
              </span>
            </>
          )}
        </div>

        {comment && (
          <div style={{ fontSize: 14, color: "var(--text)", fontStyle: "italic", marginBottom: (isPodcast || liveEvent) ? 8 : 0 }}>
            "{comment}"
          </div>
        )}

        {isPodcast && <PodcastPreviewChip url={linkUrl} fallbackLabel={label} />}
        {liveEvent && (
          <button
            className="highlight-source-chip"
            style={{ cursor: onOpenStream ? "pointer" : "default" }}
            onClick={e => { e.stopPropagation(); onOpenStream?.(liveEvent); }}
          >
            📡 {liveEvent.tags?.find(t => t[0] === "title")?.[1] || "Live Event"}
          </button>
        )}
      </div>

      {jsonOpen && <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />}
    </>
  );
}
