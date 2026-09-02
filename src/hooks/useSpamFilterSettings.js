import { useState } from "react";

const KEY = "circl_spam_filter";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function save(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
}

/**
 * Web-of-Trust spam filtering preferences. Local-only, one instance owned by App
 * and passed down (same pattern as useFeedFilterSettings) so changes propagate.
 */
export default function useSpamFilterSettings() {
  const [settings, setSettings] = useState(load);

  const update = patch => setSettings(prev => {
    const next = { ...prev, ...patch };
    save(next);
    return next;
  });

  return {
    // Filter replies/notifications to your web of trust. On by default — it's Circl.
    wotEnabled: settings.wotEnabled ?? true,
    setWotEnabled: v => update({ wotEnabled: !!v }),
    // "Nostr Dunbar number": follow lists larger than this are treated as low
    // quality and excluded from follows-of-follows. 0 = no limit (∞).
    wotDunbar: settings.wotDunbar ?? 250,
    setWotDunbar: v => update({ wotDunbar: Number(v) }),
    // Compute the graph from this account even when logged in as another
    // (multi-account). null = use the logged-in account.
    wotMainAccount: settings.wotMainAccount ?? null,
    setWotMainAccount: v => update({ wotMainAccount: v || null }),
  };
}
