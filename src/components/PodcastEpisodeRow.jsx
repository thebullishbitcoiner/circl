import { useState, useEffect, useRef } from "react";
import NoteJsonModal from "./NoteJsonModal.jsx";
import { relativeTime, nip19 } from "../utils.js";
import { broadcastEvent } from "../nostr.js";
import { useNavigation } from "../context/NavigationContext.jsx";

function EpisodeContextMenu({ event, audioUrl, onClose, onViewJson }) {
  const { isMuted, onMuteUser, onUnmuteUser, myPubkey } = useNavigation();
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8) {
      menuRef.current.style.top = "auto";
      menuRef.current.style.bottom = "100%";
    }
  }, []);

  const copyId = () => {
    let encoded = event.id || "";
    try { encoded = "nostr:" + nip19.neventEncode({ id: event.id }); } catch {}
    navigator.clipboard?.writeText(encoded).catch(() => {});
    onClose();
  };

  const copyAudio = () => {
    if (audioUrl) navigator.clipboard?.writeText(audioUrl).catch(() => {});
    onClose();
  };

  const handleBroadcast = () => {
    broadcastEvent(event);
    onClose();
  };

  const authorMuted = isMuted?.(event.pubkey);
  const isOwn = event.pubkey === myPubkey;

  const handleMute = () => {
    if (authorMuted) onUnmuteUser?.(event.pubkey);
    else onMuteUser?.(event.pubkey);
    onClose();
  };

  return (
    <div ref={menuRef} className="note-card-menu" onClick={e => e.stopPropagation()}>
      <button type="button" className="note-card-menu-item" onClick={copyId}>Copy Episode ID</button>
      {audioUrl && (
        <button type="button" className="note-card-menu-item" onClick={copyAudio}>Copy Audio URL</button>
      )}
      <button type="button" className="note-card-menu-item" onClick={handleBroadcast}>Broadcast</button>
      <button type="button" className="note-card-menu-item" onClick={() => { onClose(); onViewJson(); }}>View JSON</button>
      {!isOwn && (
        <button type="button" className="note-card-menu-item note-card-menu-item--danger" onClick={handleMute}>
          {authorMuted ? "Unmute User" : "Mute User"}
        </button>
      )}
    </div>
  );
}

export default function PodcastEpisodeRow({ event, showArt, onPlay, isPlaying }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);

  const tags     = event.tags ?? [];
  // kind 54 uses "title"/"image"/"audio"; kind 1063 uses "alt"/"name"/"thumb"/"url"
  const title    = tags.find(t => t[0] === "title")?.[1]
                ?? tags.find(t => t[0] === "alt")?.[1]
                ?? tags.find(t => t[0] === "name")?.[1]
                ?? event.content?.slice(0, 80)
                ?? "Untitled Episode";
  const image    = tags.find(t => t[0] === "image")?.[1]
                ?? tags.find(t => t[0] === "thumb")?.[1]
                ?? showArt ?? null;
  const audioUrl = tags.find(t => t[0] === "audio")?.[1]
                ?? tags.find(t => t[0] === "url")?.[1]
                ?? null;

  return (
    <>
      <div
        className="podcast-episode-row"
        style={{ zIndex: menuOpen ? 1 : undefined }}
        onClick={() => { if (!menuOpen) onPlay?.(); }}
      >
        {image ? (
          <img
            className="podcast-episode-art"
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={e => { e.target.style.display = "none"; }}
          />
        ) : (
          <div className="podcast-episode-art-placeholder" />
        )}
        <div className="podcast-episode-info">
          <div className="podcast-episode-title">{title}</div>
          <div className="podcast-episode-date">{relativeTime(event.created_at)}</div>
        </div>
        <button
          type="button"
          className={`podcast-play-btn${isPlaying ? " playing" : ""}`}
          onClick={e => { e.stopPropagation(); onPlay?.(); }}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            className="note-card-menu-btn"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            aria-label="More options"
          >
            <span /><span /><span />
          </button>
          {menuOpen && (
            <EpisodeContextMenu
              event={event}
              audioUrl={audioUrl}
              onClose={() => setMenuOpen(false)}
              onViewJson={() => { setJsonOpen(true); setMenuOpen(false); }}
            />
          )}
        </div>
      </div>
      {jsonOpen && <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />}
    </>
  );
}
