import { useState, useRef, useEffect, useCallback } from "react";
import Overlay from "./Overlay.jsx";
import Avatar from "./Avatar.jsx";
import { displayName, kind1244TagsForPublish } from "../utils.js";
import { uploadToBlossom } from "../utils/blossom.js";
import useBlossomServers from "../hooks/useBlossomServers.js";

const MAX_DURATION = 60;
const BAR_COUNT    = 40;

function formatTime(s) {
  const sec = Math.floor(s);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function makeFlatBars() {
  return Array.from({ length: BAR_COUNT }, (_, i) =>
    0.12 + 0.06 * Math.abs(Math.sin(i * 0.45))
  );
}

function RecorderWaveform({ bars, progress }) {
  return (
    <div className="vrs-waveform">
      {bars.map((h, i) => (
        <div
          key={i}
          className={`vrs-bar${progress !== null && i / bars.length < progress ? " played" : ""}`}
          style={{ height: `${Math.max(6, h * 100)}%` }}
        />
      ))}
    </div>
  );
}

function PreviewScrubZone({ bars, progress, onScrub }) {
  const zoneRef  = useRef(null);
  const dragging = useRef(false);

  const scrub = (clientX) => {
    const rect = zoneRef.current?.getBoundingClientRect();
    if (!rect) return;
    onScrub(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
  };

  return (
    <div
      ref={zoneRef}
      className="vrs-scrub-zone"
      onMouseDown={e => { dragging.current = true; scrub(e.clientX); }}
      onMouseMove={e => { if (dragging.current) scrub(e.clientX); }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
      onTouchStart={e => { dragging.current = true; scrub(e.touches[0].clientX); }}
      onTouchMove={e => { if (dragging.current) scrub(e.touches[0].clientX); }}
      onTouchEnd={() => { dragging.current = false; }}
    >
      <RecorderWaveform bars={bars} progress={progress} />
      <div className="voice-scrubber" style={{ marginTop: 6 }}>
        <div className="voice-scrubber-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

/** Recorder UI body — usable standalone or embedded inside ComposeSheet. */
export function VoiceRecorderBody({
  replyTo, myPubkey, publishEvent, onPrepend, onDismiss,
  blossomServers: blossomServersProp,
  onPhaseChange,  // (phase: string) => void — called on every phase transition
  onSendReady,    // (fn: () => void) => void — called once on mount with stable send trigger
}) {
  const [phase, _setPhase]          = useState("idle");
  const [elapsed, setElapsed]       = useState(0);
  const [error, setError]           = useState(null);
  const [liveBars, setLiveBars]     = useState(makeFlatBars);
  const [frozenBars, setFrozenBars] = useState(makeFlatBars);
  const [blob, setBlob]             = useState(null);
  const [previewPlay, setPreviewPlay] = useState(false);
  const [previewProg, setPreviewProg] = useState(0);
  const [previewDur, setPreviewDur]   = useState(0);

  const recorderRef  = useRef(null);
  const streamRef    = useRef(null);
  const audioCtxRef  = useRef(null);
  const analyserRef  = useRef(null);
  const rafRef       = useRef(null);
  const timerRef     = useRef(null);
  const chunksRef    = useRef([]);
  const previewRef   = useRef(null);
  const blobUrlRef   = useRef(null);

  // Keep onPhaseChange stable across renders via ref
  const onPhaseChangeRef = useRef(onPhaseChange);
  useEffect(() => { onPhaseChangeRef.current = onPhaseChange; }, [onPhaseChange]);

  const setPhase = useCallback((p) => {
    _setPhase(p);
    onPhaseChangeRef.current?.(p);
  }, []);

  const { servers: hookServers } = useBlossomServers({ pubkey: myPubkey });
  const blossomServers = blossomServersProp?.length ? blossomServersProp : hookServers;

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current   = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => () => {
    stopStream();
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
  }, [stopStream]);

  const startRecording = async () => {
    setError(null);
    setElapsed(0);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source   = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      let lastBars = makeFlatBars();
      const tick = () => {
        analyser.getByteFrequencyData(freqData);
        const step = Math.max(1, Math.floor(freqData.length / BAR_COUNT));
        const next = Array.from({ length: BAR_COUNT }, (_, i) => {
          const raw = freqData[Math.min(i * step, freqData.length - 1)] / 255;
          return lastBars[i] * 0.5 + raw * 0.5;
        });
        lastBars = next;
        setLiveBars([...next]);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      const mimeType = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]
        .find(t => MediaRecorder.isTypeSupported(t)) ?? "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setBlob(recorded);
        setFrozenBars([...lastBars]);
        stopStream();
        setPhase("preview");
      };
      recorder.start(100);
      setPhase("recording");

      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          if (next >= MAX_DURATION) doStop(recorder);
          return next;
        });
      }, 1000);
    } catch {
      setError("Microphone permission denied");
    }
  };

  const doStop = (rec) => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    (rec ?? recorderRef.current)?.stop();
  };

  const stopRecording = () => doStop();

  const resetRecording = () => {
    if (previewRef.current) previewRef.current.pause();
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    setBlob(null);
    setPreviewPlay(false);
    setPreviewProg(0);
    setPreviewDur(0);
    setElapsed(0);
    setLiveBars(makeFlatBars());
    setFrozenBars(makeFlatBars());
    setError(null);
    setPhase("idle");
  };

  const togglePreviewPlay = () => {
    const audio = previewRef.current;
    if (!audio) return;
    if (previewPlay) audio.pause();
    else audio.play().catch(() => {});
  };

  const handlePreviewScrub = (ratio) => {
    const audio = previewRef.current;
    if (!audio || !previewDur) return;
    audio.currentTime = ratio * previewDur;
    setPreviewProg(ratio);
  };

  const uploadFile = async (file) => {
    if (blossomServers.length > 0) {
      const url = await uploadToBlossom(file, blossomServers, myPubkey);
      if (url) return url;
    }
    const uploadUrl = "https://nostr.build/api/v2/upload/files";
    let authHeader = "";
    if (myPubkey && window.nostr?.signEvent) {
      const buf         = await file.arrayBuffer();
      const digest      = await crypto.subtle.digest("SHA-256", buf);
      const payloadHash = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, "0")).join("");
      const authEvent = await window.nostr.signEvent({
        kind: 27235, pubkey: myPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["u", uploadUrl], ["method", "POST"], ["payload", payloadHash]],
        content: "",
      });
      authHeader = `Nostr ${btoa(JSON.stringify(authEvent))}`;
    }
    const form = new FormData();
    form.append("file", file);
    const res  = await fetch(uploadUrl, { method: "POST", headers: authHeader ? { Authorization: authHeader } : {}, body: form });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const url  = json?.nip94_event?.tags?.find(t => t[0] === "url")?.[1] ?? json?.data?.[0]?.url;
    if (!url) throw new Error("No URL");
    return url;
  };

  // Mutable ref so onSendReady only needs to be called once, always invokes current version
  const handleSendRef = useRef(null);
  useEffect(() => {
    handleSendRef.current = async () => {
      if (!blob) return;
      setPhase("uploading");
      setError(null);
      const ext  = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
      try {
        const audioUrl  = await uploadFile(file);
        const tags      = kind1244TagsForPublish(replyTo);
        const published = await publishEvent({ kind: 1244, content: audioUrl, tags });
        if (published) {
          onPrepend?.(published);
          onDismiss?.();
        } else {
          throw new Error("Publish failed");
        }
      } catch (err) {
        setError(err.message || "Failed — please try again");
        setPhase("preview");
      }
    };
  }); // runs every render so closure captures latest blob/blossomServers/etc.

  // Register the stable trigger once on mount
  useEffect(() => {
    onSendReady?.(() => handleSendRef.current?.());
  }, []); // eslint-disable-line

  return (
    <div className="vrs-body">
      {phase === "preview" ? (
        <div className="vrs-preview">
          <button
            className={`audio-play-btn voice-play-btn vrs-play${previewPlay ? " playing" : ""}`}
            onClick={togglePreviewPlay}
            aria-label={previewPlay ? "Pause" : "Play"}
          >
            {previewPlay
              ? <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              : <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>}
          </button>
          <PreviewScrubZone bars={frozenBars} progress={previewProg} onScrub={handlePreviewScrub} />
          {blob && (
            <audio
              ref={previewRef}
              src={blobUrlRef.current || (() => { blobUrlRef.current = URL.createObjectURL(blob); return blobUrlRef.current; })()}
              onPlay={() => setPreviewPlay(true)}
              onPause={() => setPreviewPlay(false)}
              onEnded={() => { setPreviewPlay(false); setPreviewProg(0); }}
              onLoadedMetadata={e => setPreviewDur(e.target.duration || 0)}
              onTimeUpdate={e => {
                const a = e.target;
                if (a.duration && isFinite(a.duration)) setPreviewProg(a.currentTime / a.duration);
              }}
            />
          )}
        </div>
      ) : (
        <RecorderWaveform bars={liveBars} progress={null} />
      )}

      <div className="vrs-timer">
        {phase === "recording"
          ? <><span className="vrs-dot" />{formatTime(elapsed)} / {formatTime(MAX_DURATION)}</>
          : phase === "preview"
            ? formatTime(previewDur > 0 ? previewProg * previewDur : elapsed)
            : formatTime(0)}
      </div>

      {error && <div className="vrs-error">{error}</div>}

      <div className="vrs-controls">
        {phase === "idle" && (
          <button className="vrs-btn" onClick={startRecording} aria-label="Record">
            <svg width={26} height={26} viewBox="0 0 24 24" fill="currentColor">
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {phase === "recording" && (
          <button className="vrs-btn vrs-btn--stop" onClick={stopRecording} aria-label="Stop recording">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="3" />
            </svg>
          </button>
        )}
        {phase === "preview" && (
          <button className="vrs-btn vrs-btn--rerecord" onClick={resetRecording} aria-label="Re-record">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
            </svg>
          </button>
        )}
        {phase === "uploading" && <div className="vrs-spinner" />}
      </div>

      <div className="vrs-hint">
        {phase === "idle"      && "Tap to record"}
        {phase === "recording" && "Tap to stop"}
        {phase === "preview"   && "Tap to re-record"}
        {phase === "uploading" && "Publishing…"}
      </div>
    </div>
  );
}

/** Standalone voice reply sheet — wraps VoiceRecorderBody in the compose overlay. */
export default function VoiceRecorderSheet({
  replyTo, profiles, myPubkey, publishEvent, onPrepend, onDismiss,
}) {
  const [voicePhase, setVoicePhase] = useState("idle");
  const voiceSendRef = useRef(null);

  return (
    <Overlay onDismiss={voicePhase !== "uploading" ? onDismiss : undefined} compose>
      <div className="compose-sheet vrs-sheet">
        <div className="compose-sheet-bar">
          <button className="compose-sheet-cancel" onClick={onDismiss} disabled={voicePhase === "uploading"}>Cancel</button>
          <span className="vrs-title">Voice Reply</span>
          <button
            className="compose-sheet-post"
            disabled={voicePhase !== "preview"}
            onClick={() => voiceSendRef.current?.()}
          >
            {voicePhase === "uploading" ? "Publishing…" : "Send"}
          </button>
        </div>
        {replyTo && (
          <div className="vrs-context">
            <Avatar pk={replyTo.pubkey} profiles={profiles} size={18} />
            <span className="vrs-context-label">Replying to {displayName(replyTo.pubkey, profiles)}</span>
          </div>
        )}
        <VoiceRecorderBody
          replyTo={replyTo} myPubkey={myPubkey}
          publishEvent={publishEvent} onPrepend={onPrepend} onDismiss={onDismiss}
          onPhaseChange={setVoicePhase}
          onSendReady={fn => { voiceSendRef.current = fn; }}
        />
      </div>
    </Overlay>
  );
}
