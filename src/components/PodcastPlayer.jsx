import { useState, useEffect, useRef } from "react";

function fmtTime(secs) {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PodcastPlayer({ episode, showMeta, onClose }) {
  const audioRef  = useRef(null);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);

  const etags    = episode?.tags ?? [];
  // kind 54: "title"/"audio"/"image"; kind 1063: "alt"/"name"/"url"/"thumb"
  const title    = etags.find(t => t[0] === "title")?.[1]
                ?? etags.find(t => t[0] === "alt")?.[1]
                ?? etags.find(t => t[0] === "name")?.[1]
                ?? "Untitled";
  const audioUrl = etags.find(t => t[0] === "audio")?.[1]
                ?? etags.find(t => t[0] === "url")?.[1]
                ?? null;
  const artUrl   = etags.find(t => t[0] === "image")?.[1]
                ?? etags.find(t => t[0] === "thumb")?.[1]
                ?? showMeta?.tags?.find(t => t[0] === "image")?.[1] ?? null;
  const showName = showMeta?.tags?.find(t => t[0] === "title")?.[1] ?? null;

  // Auto-play when episode changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    el.src = audioUrl;
    el.load();
    el.play().catch(() => {});
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
  }, [audioUrl]);

  // Clean up on unmount
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) { el.play().catch(() => {}); setIsPlaying(true); }
    else           { el.pause();                 setIsPlaying(false); }
  };

  const handleSeek = (e) => {
    const el = audioRef.current;
    if (!el || !isFinite(el.duration)) return;
    el.currentTime = Number(e.target.value);
  };

  const handleClose = () => {
    audioRef.current?.pause();
    onClose?.();
  };

  return (
    <div className="podcast-player-bar">
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {artUrl && (
        <img
          className="podcast-player-art"
          src={artUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={e => { e.target.style.display = "none"; }}
        />
      )}

      <div className="podcast-player-info">
        <div className="podcast-player-title">{title}</div>
        {showName && <div className="podcast-player-show">{showName}</div>}
      </div>

      <div className="podcast-player-controls">
        <button
          type="button"
          className="podcast-play-btn"
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
          className="podcast-player-seek"
          min={0}
          max={isFinite(duration) && duration > 0 ? duration : 0}
          step={1}
          value={currentTime}
          onChange={handleSeek}
        />
        <div className="podcast-player-time">{fmtTime(currentTime)} / {fmtTime(duration)}</div>
      </div>

      <button
        type="button"
        className="podcast-player-close"
        onClick={handleClose}
        aria-label="Close player"
      >
        ×
      </button>
    </div>
  );
}
