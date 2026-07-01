import { useState, useEffect } from "react";
import { useAudio } from "../contexts/AudioContext.jsx";

function PlayBtn({ isPlaying, onClick }) {
  return (
    <button
      type="button"
      className={`audio-play-btn${isPlaying ? " playing" : ""}`}
      onClick={e => { e.stopPropagation(); onClick(); }}
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
  );
}

function filenamFromUrl(url) {
  try {
    const path = new URL(url).pathname;
    const name = path.split("/").pop() || url;
    return decodeURIComponent(name);
  } catch {
    return url;
  }
}

function DirectAudioAttachment({ url }) {
  const { playingEpisode, setPlayingEpisode, setPlayingShowMeta, togglePlay } = useAudio();
  const isPlaying = playingEpisode?.id === url;

  const play = () => {
    if (isPlaying) {
      togglePlay();
    } else {
      setPlayingShowMeta(null);
      setPlayingEpisode({ id: url, tags: [["url", url]], content: "" });
    }
  };

  return (
    <div className="note-audio-attachment" onClick={e => e.stopPropagation()}>
      <div className="note-audio-art-placeholder">
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
      </div>
      <div className="note-audio-info">
        <div className="note-audio-title">{filenamFromUrl(url)}</div>
      </div>
      <PlayBtn isPlaying={isPlaying} onClick={play} />
    </div>
  );
}

function WavlakeAttachment({ url }) {
  const { playingEpisode, setPlayingEpisode, setPlayingShowMeta, togglePlay } = useAudio();
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const trackId = url.match(/wavlake\.com\/track\/([0-9a-f-]+)/i)?.[1];
    if (!trackId) { setError(true); setLoading(false); return; }
    fetch(`https://catalog.wavlake.com/v1/tracks/${trackId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(json => {
        if (!cancelled) setMeta(json.data ?? json);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  const liveUrl = meta?.liveUrl ?? null;
  const title   = meta?.title ?? "Wavlake Track";
  const artist  = meta?.artist ?? null;
  const art     = meta?.artworkUrl ?? null;

  const syntheticId = liveUrl ?? url;
  const isPlaying   = playingEpisode?.id === syntheticId;

  const play = () => {
    if (!liveUrl) return;
    if (isPlaying) {
      togglePlay();
    } else {
      setPlayingShowMeta(null);
      setPlayingEpisode({
        id: syntheticId,
        tags: [
          ["url",   liveUrl],
          ["title", title],
          ...(art ? [["image", art]] : []),
          ...(artist ? [["summary", artist]] : []),
        ],
        content: "",
      });
    }
  };

  if (loading) {
    return (
      <div className="note-audio-attachment note-audio-loading" onClick={e => e.stopPropagation()}>
        <div className="note-audio-art-placeholder" />
        <div className="note-audio-info">
          <div className="note-audio-title" style={{ opacity: 0.4 }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (error || !liveUrl) {
    return (
      <a
        className="note-audio-attachment note-audio-fallback"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
      >
        <div className="note-audio-art-placeholder">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <div className="note-audio-info">
          <div className="note-audio-title">{url}</div>
        </div>
      </a>
    );
  }

  return (
    <div className="note-audio-attachment" onClick={e => e.stopPropagation()}>
      {art ? (
        <img
          className="note-audio-art"
          src={art}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={e => { e.target.style.display = "none"; }}
        />
      ) : (
        <div className="note-audio-art-placeholder">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
        </div>
      )}
      <div className="note-audio-info">
        <div className="note-audio-title">{title}</div>
        {artist && <div className="note-audio-subtitle">{artist}</div>}
      </div>
      <PlayBtn isPlaying={isPlaying} onClick={play} />
    </div>
  );
}

export default function NoteAudioAttachment({ url, platform }) {
  if (platform === "wavlake") return <WavlakeAttachment url={url} />;
  return <DirectAudioAttachment url={url} />;
}
