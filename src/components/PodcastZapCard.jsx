import { useState } from "react";
import Avatar from "./Avatar.jsx";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import { displayName, relativeTime, fmtSats, parseBolt11Msats, zapCommentFromKind9735, zapperPubkeyFromKind9735 } from "../utils.js";

function podcastLinks(ev) {
  const items = ev.tags?.filter(t => t[0] === "i" && typeof t[1] === "string") ?? [];
  const episode = items.find(t => t[1].startsWith("podcast:item:guid:"));
  const show    = items.find(t => t[1].startsWith("podcast:guid:"));
  return { episodeUrl: episode?.[2] ?? null, showUrl: show?.[2] ?? null };
}

function linkLabel(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

export default function PodcastZapCard({ event, profiles, onOpenProfile, delay = 0 }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);

  const zapperPk    = zapperPubkeyFromKind9735(event) ?? event.tags?.find(t => t[0] === "P")?.[1] ?? null;
  const recipientPk = event.tags?.find(t => t[0] === "p")?.[1] ?? null;
  const msats       = parseBolt11Msats(event.tags?.find(t => t[0] === "bolt11")?.[1]);
  const comment     = zapCommentFromKind9735(event);
  const { episodeUrl, showUrl } = podcastLinks(event);
  const isPodcast = !!(episodeUrl || showUrl);
  const showRecipient = recipientPk && recipientPk !== zapperPk;

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

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: (comment || isPodcast) ? 8 : 0 }}>
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
          <div style={{ fontSize: 14, color: "var(--text)", fontStyle: "italic", marginBottom: isPodcast ? 8 : 0 }}>
            "{comment}"
          </div>
        )}

        {isPodcast && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {episodeUrl && (
              <a className="highlight-source-chip" href={episodeUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
                </svg>
                {linkLabel(episodeUrl)}
              </a>
            )}
            {showUrl && (
              <a className="highlight-source-chip" href={showUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                </svg>
                {linkLabel(showUrl)}
              </a>
            )}
          </div>
        )}
      </div>

      {jsonOpen && <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />}
    </>
  );
}
