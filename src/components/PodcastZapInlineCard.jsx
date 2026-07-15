import { useState, useEffect } from "react";
import PodcastPreviewChip from "./PodcastPreviewChip.jsx";
import NoteText from "./NoteText.jsx";
import { displayName, fmtSats, parseBolt11Msats, zapCommentFromKind9735, zapperPubkeyFromKind9735 } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";

const stripPodcastSuffix = t =>
  t.replace(/\s*•\s*(Watch|Listen|Play|Stream) on \S+\s*$/i, "").trim();

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

export default function PodcastZapInlineCard({ event, profiles, onOpenProfile, onOpenStream }) {
  const [liveEvent, setLiveEvent] = useState(null);

  const zapperPk    = zapperPubkeyFromKind9735(event) ?? event.tags?.find(t => t[0] === "P")?.[1] ?? null;
  const msats       = parseBolt11Msats(event.tags?.find(t => t[0] === "bolt11")?.[1]);
  const comment     = zapCommentFromKind9735(event);
  const { isPodcast, linkUrl, label } = podcastInfo(event);

  const aTagVal = event.tags?.find(t => t[0] === "a")?.[1] ?? null;
  useEffect(() => {
    if (!aTagVal) return;
    const [kindStr, evPubkey, dTag] = aTagVal.split(":");
    if (kindStr !== "30311" || !evPubkey || !dTag) return;
    const cached = eventStore.getTimeline([{ kinds: [30311], authors: [evPubkey], "#d": [dTag], limit: 1 }])?.[0];
    if (cached) { setLiveEvent(cached); return; }
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
    const sub = pool.request(relayUrls, [{ kinds: [30311], authors: [evPubkey], "#d": [dTag], limit: 1 }]).subscribe({
      next: ev => { eventStore.add(ev); setLiveEvent(ev); },
    });
    return () => sub.unsubscribe();
  }, [aTagVal]);

  const liveTitle = liveEvent?.tags?.find(t => t[0] === "title")?.[1] ?? null;
  const hasTarget = isPodcast || !!liveTitle;

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 14, lineHeight: 1.4, marginBottom: (comment || isPodcast) ? 8 : 0 }}>
        <span
          className="ix-mention"
          style={{ cursor: zapperPk ? "pointer" : "default" }}
          onClick={e => { if (!zapperPk) return; e.stopPropagation(); onOpenProfile?.(zapperPk); }}
        >
          @{zapperPk ? displayName(zapperPk, profiles) : "Anonymous"}
        </span>
        {" "}<span style={{ color: "var(--text-faint)" }}>zapped</span>{" "}
        <span style={{ fontWeight: 600, color: "#f59e0b" }}>⚡ {fmtSats(msats)}</span>
        {hasTarget && (
          <>{" "}<span style={{ color: "var(--text-faint)" }}>to</span>{" "}
          {liveTitle ? (
            <span
              style={{ fontWeight: 500, cursor: onOpenStream && liveEvent ? "pointer" : "default", textDecoration: onOpenStream && liveEvent ? "underline" : "none" }}
              onClick={e => { if (!onOpenStream || !liveEvent) return; e.stopPropagation(); onOpenStream(liveEvent); }}
            >
              <span className="live-badge">Live</span>{liveTitle}
            </span>
          ) : (
            <span style={{ fontWeight: 500 }}>{label}</span>
          )}
          </>
        )}
      </div>

      {comment && (
        <NoteText
          content={`"${comment}"`}
          profiles={profiles}
          onOpenProfile={onOpenProfile}
          style={{ fontSize: 14, color: "var(--text-muted)", fontStyle: "italic", marginBottom: isPodcast ? 8 : 0 }}
        />
      )}

      {isPodcast && <PodcastPreviewChip url={linkUrl} fallbackLabel={label} />}
    </div>
  );
}
