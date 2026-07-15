import { useEffect, useState, useRef, useCallback } from "react";
import { publishSession$ } from "../nostr.js";

export const PUBLISH_STATUS_AUTO_DISMISS_MS = 5_000;

export default function usePublishStatus() {
  const [session, setSession] = useState(publishSession$.value);
  const dismissedId = useRef(null);

  useEffect(() => {
    const sub = publishSession$.subscribe(setSession);
    return () => sub.unsubscribe();
  }, []);

  const dismiss = useCallback(() => {
    dismissedId.current = publishSession$.value?.id ?? null;
    setSession(s => (s ? { ...s } : s));
  }, []);

  // Auto-dismiss a fixed 10s after each new session starts, regardless of
  // whether every relay has settled yet — keyed on session.id so per-relay
  // status updates (which produce a new session object with the same id)
  // don't restart the timer.
  useEffect(() => {
    if (!session || session.id === dismissedId.current) return;
    const id = session.id;
    const timer = setTimeout(() => {
      dismissedId.current = id;
      setSession(s => (s ? { ...s } : s));
    }, PUBLISH_STATUS_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [session?.id]);

  const visible = session && session.id !== dismissedId.current;
  return { session: visible ? session : null, dismiss };
}
