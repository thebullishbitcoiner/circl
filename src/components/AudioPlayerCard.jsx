import { useAudio } from "../contexts/AudioContext.jsx";

function fmtTime(secs) {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayerCard() {
  const { playingEpisode, playingShowMeta, isPlaying, currentTime, duration, togglePlay, seekTo, stop } = useAudio();

  if (!playingEpisode) return null;

  const etags    = playingEpisode.tags ?? [];
  const title    = etags.find(t => t[0] === "title")?.[1]
                ?? etags.find(t => t[0] === "alt")?.[1]
                ?? etags.find(t => t[0] === "name")?.[1]
                ?? "Untitled";
  const artUrl   = etags.find(t => t[0] === "image")?.[1]
                ?? etags.find(t => t[0] === "thumb")?.[1]
                ?? playingShowMeta?.tags?.find(t => t[0] === "image")?.[1] ?? null;
  const subtitle = playingShowMeta?.tags?.find(t => t[0] === "title")?.[1]
                ?? etags.find(t => t[0] === "summary")?.[1]
                ?? null;

  return (
    <div className="panel-card audio-player-card">
      <button type="button" className="audio-player-close audio-card-close" onClick={stop} aria-label="Stop">×</button>

      {/* Row 1: art + info */}
      <div className="audio-card-row">
        <div className="audio-card-art-wrap" onClick={togglePlay}>
          {artUrl ? (
            <img
              className="audio-card-art"
              src={artUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={e => { e.target.style.display = "none"; }}
            />
          ) : (
            <div className="audio-card-art audio-card-art-placeholder">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
          <div className="audio-card-overlay">
            {isPlaying ? (
              <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6,3 20,12 6,21" />
              </svg>
            )}
          </div>
        </div>

        <div className="audio-card-info">
          <div className="audio-card-title">{title}</div>
          {subtitle && <div className="audio-card-subtitle">{subtitle}</div>}
        </div>
      </div>

      {/* Row 2: seek bar + timestamps */}
      <div className="audio-card-seek-row">
        <span className="audio-card-time">{fmtTime(currentTime)}</span>
        <input
          type="range"
          className="audio-player-seek"
          min={0}
          max={isFinite(duration) && duration > 0 ? duration : 0}
          step={1}
          value={currentTime}
          onChange={e => seekTo(Number(e.target.value))}
        />
        <span className="audio-card-time">{fmtTime(duration)}</span>
      </div>
    </div>
  );
}
