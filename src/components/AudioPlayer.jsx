import { useAudio } from "../contexts/AudioContext.jsx";

function fmtTime(secs) {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer() {
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
  const subtitle = playingShowMeta?.tags?.find(t => t[0] === "title")?.[1] ?? null;

  return (
    <div className="audio-player-bar">
      {artUrl && (
        <img
          className="audio-player-art"
          src={artUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={e => { e.target.style.display = "none"; }}
        />
      )}

      <div className="audio-player-info">
        <div className="audio-player-title">{title}</div>
        {subtitle && <div className="audio-player-subtitle">{subtitle}</div>}
      </div>

      <div className="audio-player-controls">
        <button
          type="button"
          className="audio-play-btn"
          style={{ border: "none", background: "none", color: "var(--text)", width: 32, height: 32 }}
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>
        <input
          type="range"
          className="audio-player-seek"
          min={0}
          max={isFinite(duration) && duration > 0 ? duration : 0}
          step={1}
          value={currentTime}
          onChange={e => seekTo(Number(e.target.value))}
        />
        <div className="audio-player-time">{fmtTime(currentTime)} / {fmtTime(duration)}</div>
      </div>

      <button type="button" className="audio-player-close" onClick={stop} aria-label="Close player">×</button>
    </div>
  );
}
