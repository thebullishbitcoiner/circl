import { useState, useRef, useMemo } from "react";
import NoteJsonModal from "./NoteJsonModal.jsx";
import NoteActions from "./NoteActions.jsx";
import { relativeTime, nip19 } from "../utils.js";
import { broadcastEvent } from "../nostr.js";
import { useNavigation } from "../context/NavigationContext.jsx";
import { claimPlayback, releasePlayback, captureForResume } from "../voicePlayback.js";

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Unified waveform + scrubber zone: click anywhere to seek, drag to scrub.
// Stops propagation so the parent row's thread-open handler is not triggered.
function VoiceScrubZone({ amplitudes, progress, onScrub }) {
  const zoneRef  = useRef(null);
  const dragging = useRef(false);

  const bars = useMemo(() => {
    if (amplitudes && amplitudes.length > 0) {
      const max  = Math.max(...amplitudes, 1);
      const step = Math.max(1, Math.floor(amplitudes.length / 40));
      const out  = [];
      for (let i = 0; i < amplitudes.length; i += step) out.push(amplitudes[i] / max);
      return out;
    }
    return Array.from({ length: 30 }, (_, i) =>
      0.25 + 0.5 * Math.abs(Math.sin(i * 0.45)) + 0.25 * Math.abs(Math.sin(i * 0.9))
    );
  }, [amplitudes]);

  const scrub = (clientX) => {
    const rect = zoneRef.current?.getBoundingClientRect();
    if (!rect) return;
    onScrub(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
  };

  return (
    <div
      ref={zoneRef}
      className="voice-scrub-zone"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => { e.stopPropagation(); dragging.current = true; scrub(e.clientX); }}
      onMouseMove={e => { if (dragging.current) scrub(e.clientX); }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
      onTouchStart={e => { e.stopPropagation(); dragging.current = true; scrub(e.touches[0].clientX); }}
      onTouchMove={e => { if (dragging.current) { e.stopPropagation(); scrub(e.touches[0].clientX); } }}
      onTouchEnd={() => { dragging.current = false; }}
    >
      <div className="voice-waveform">
        {bars.map((h, i) => (
          <div
            key={i}
            className={`voice-waveform-bar${i / bars.length < progress ? " played" : ""}`}
            style={{ height: `${Math.max(15, h * 100)}%` }}
          />
        ))}
      </div>
      <div className="voice-scrubber">
        <div className="voice-scrubber-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

// Isolated sub-component: playing/progress state lives here so onTimeUpdate
// re-renders only this, not the parent VoiceMessageRow/NoteActions/ZapBadges.
function VoicePlayerControls({ event }) {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  const audioUrl = event.content || null;

  const imetaTag = event.tags?.find(t => t[0] === "imeta");
  let imetaDuration    = null;
  let waveformAmplitudes = null;
  if (imetaTag) {
    const entries = imetaTag.slice(1);
    const durEntry = entries.find(v => typeof v === "string" && v.startsWith("duration "));
    if (durEntry) imetaDuration = parseInt(durEntry.split(" ")[1], 10);
    const wvEntry = entries.find(v => typeof v === "string" && v.startsWith("waveform "));
    if (wvEntry) waveformAmplitudes = wvEntry.split(" ").slice(1).map(Number).filter(n => !isNaN(n));
  }

  const togglePlay = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (playing) { audio.pause(); }
    else { claimPlayback(audio, event.id); audio.play().catch(() => {}); }
  };

  const handleScrub = (ratio) => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = (audio.duration && isFinite(audio.duration)) ? audio.duration : imetaDuration;
    if (dur) { audio.currentTime = ratio * dur; setProgress(ratio); }
  };

  return (
    <>
      <button
        type="button"
        className={`audio-play-btn voice-play-btn${playing ? " playing" : ""}`}
        onClick={togglePlay}
        aria-label={playing ? "Pause" : "Play"}
        disabled={!audioUrl}
      >
        {playing ? (
          <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>
      <div className="voice-message-body">
        <VoiceScrubZone amplitudes={waveformAmplitudes} progress={progress} onScrub={handleScrub} />
        <div className="voice-message-meta">
          <span className="voice-duration">{formatDuration(imetaDuration) ?? "≤1:00"}</span>
          <span className="voice-timestamp">{relativeTime(event.created_at)}</span>
        </div>
      </div>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => { setPlaying(false); releasePlayback(audioRef.current); }}
          onEnded={() => { setPlaying(false); setProgress(0); releasePlayback(audioRef.current); }}
          onTimeUpdate={() => {
            const a = audioRef.current;
            if (a?.duration && isFinite(a.duration)) setProgress(a.currentTime / a.duration);
          }}
        />
      )}
    </>
  );
}

function VoiceContextMenu({ event, onClose, onViewJson }) {
  const { isMuted, onMuteUser, onUnmuteUser, myPubkey } = useNavigation();
  const menuRef = useRef(null);
  const audioUrl = event.content || null;

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

  const authorMuted = isMuted?.(event.pubkey);
  const isOwn = event.pubkey === myPubkey;

  return (
    <div ref={menuRef} className="note-card-menu" onClick={e => e.stopPropagation()}>
      <button type="button" className="note-card-menu-item" onClick={copyId}>Copy Note ID</button>
      {audioUrl && (
        <button type="button" className="note-card-menu-item" onClick={copyAudio}>Copy Audio URL</button>
      )}
      <button type="button" className="note-card-menu-item" onClick={() => { broadcastEvent(event); onClose(); }}>Broadcast</button>
      <button type="button" className="note-card-menu-item" onClick={() => { onClose(); onViewJson(); }}>View JSON</button>
      {!isOwn && (
        <button type="button" className="note-card-menu-item note-card-menu-item--danger" onClick={() => {
          if (authorMuted) onUnmuteUser?.(event.pubkey);
          else onMuteUser?.(event.pubkey);
          onClose();
        }}>
          {authorMuted ? "Unmute User" : "Mute User"}
        </button>
      )}
    </div>
  );
}

export default function VoiceMessageRow({
  event, onOpenThread,
  profiles, myPubkey, myProfile, allEvents,
  onOpenZaps, onOpenReactions, onOpenReposts,
  onPublish, publishEvent, onPrepend, onBookmark, isBookmarked,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  onRequestModal, onDismissModal,
  sendZap, defaultZapAmount, defaultZapMsg, onZapFail,
  customEmojis,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);

  return (
    <>
      <div
        className="voice-message-card"
        onClick={onOpenThread ? () => { captureForResume(event.id); onOpenThread(event); } : undefined}
        role={onOpenThread ? "button" : undefined}
      >
        <div
          className="voice-message-row"
          style={{ zIndex: menuOpen ? 1 : undefined }}
        >
          <VoicePlayerControls event={event} />
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
              <VoiceContextMenu
                event={event}
                onClose={() => setMenuOpen(false)}
                onViewJson={() => { setJsonOpen(true); setMenuOpen(false); }}
              />
            )}
          </div>
        </div>
        <div className="voice-message-actions">
          <NoteActions
            event={event} profiles={profiles}
            myPubkey={myPubkey} myProfile={myProfile} events={allEvents}
            onOpenThread={onOpenThread} onOpenZaps={onOpenZaps}
            onOpenReactions={onOpenReactions} onOpenReposts={onOpenReposts}
            onPublish={onPublish} publishEvent={publishEvent} onPrepend={onPrepend}
            onBookmark={onBookmark} isBookmarked={isBookmarked}
            getLocalZaps={getLocalZaps} addLocalZap={addLocalZap}
            getLocalReactions={getLocalReactions} setLocalReaction={setLocalReaction}
            onRequestModal={onRequestModal} onDismissModal={onDismissModal}
            sendZap={sendZap} defaultZapAmount={defaultZapAmount}
            defaultZapMsg={defaultZapMsg} onZapFail={onZapFail}
            customEmojis={customEmojis}
          />
        </div>
      </div>
      {jsonOpen && <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />}
    </>
  );
}
