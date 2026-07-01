import { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";

const AudioContext = createContext({});

export default AudioContext;

export function useAudio() {
  return useContext(AudioContext);
}

export function AudioProvider({ children }) {
  const [playingEpisode,  setPlayingEpisode]  = useState(null);
  const [playingShowMeta, setPlayingShowMeta] = useState(null);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,   setDuration]   = useState(0);
  const audioRef = useRef(null);

  // Load and auto-play when episode changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!playingEpisode) { el.pause(); return; }
    const tags = playingEpisode.tags ?? [];
    const url  = tags.find(t => t[0] === "audio")?.[1]
              ?? tags.find(t => t[0] === "url")?.[1]
              ?? null;
    if (!url) return;
    el.src = url;
    el.load();
    el.play().catch(() => {});
    setCurrentTime(0);
    setDuration(0);
  }, [playingEpisode]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);

  const seekTo = useCallback((time) => {
    const el = audioRef.current;
    if (el && isFinite(el.duration)) el.currentTime = time;
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlayingEpisode(null);
    setPlayingShowMeta(null);
  }, []);

  return (
    <AudioContext.Provider value={{
      playingEpisode, setPlayingEpisode,
      playingShowMeta, setPlayingShowMeta,
      isPlaying, currentTime, duration,
      togglePlay, seekTo, stop,
    }}>
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      {children}
    </AudioContext.Provider>
  );
}
