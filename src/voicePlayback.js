let current       = null;
let currentId     = null;
let pendingResume = null; // { id, time } — set when navigating away mid-playback

export function claimPlayback(audio, eventId) {
  if (current && current !== audio) current.pause();
  current   = audio;
  currentId = eventId;
}

export function releasePlayback(audio) {
  if (current === audio) { current = null; currentId = null; }
}

// Called when the user navigates into a thread while this event is playing.
// Saves the current position and pauses so ThreadVoicePlayer can resume.
export function captureForResume(eventId) {
  if (currentId !== eventId || !current) return;
  pendingResume = { id: eventId, time: current.currentTime };
  current.pause();
}

// Called by ThreadVoicePlayer on mount — returns the saved time if available, then clears it.
export function takePendingResume(eventId) {
  if (pendingResume?.id !== eventId) return null;
  const t = pendingResume.time;
  pendingResume = null;
  return t;
}
