import { useEffect, useRef, useState } from "react";
import { isHexPubkey, normPubkey, hasNip44 } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";
import {
  isLocalDarkPreferenceNewer,
  readStoredDarkPreference,
} from "./useDarkMode.js";

const SETTINGS_KIND = 30078;
const SETTINGS_D_TAG = "circl-settings";
const SETTLE_CUTOFF_MS = 8000;
const PUBLISH_DEBOUNCE_MS = 800;

function buildSnapshot({ dark, textSize, contentSettings, zapSettings }) {
  return {
    dark,
    textSize,
    bigFontShortNotes: contentSettings.bigFontShortNotes,
    autoplayVideos: contentSettings.autoplayVideos,
    loopVideos: contentSettings.loopVideos,
    relayAuth: contentSettings.relayAuth,
    zapAmount: zapSettings.amount,
    zapMsg: zapSettings.msg,
    zapPresets: zapSettings.presets,
  };
}

function applySnapshot(settings, { setDark, setTextSize, contentSettings, saveZapSettings }) {
  if (typeof settings.dark === "boolean") setDark(settings.dark);
  if (typeof settings.textSize === "string") setTextSize(settings.textSize);
  if (typeof settings.bigFontShortNotes === "boolean") contentSettings.setBigFontShortNotes(settings.bigFontShortNotes);
  if (typeof settings.autoplayVideos === "boolean") contentSettings.setAutoplayVideos(settings.autoplayVideos);
  if (typeof settings.loopVideos === "boolean") contentSettings.setLoopVideos(settings.loopVideos);
  if (typeof settings.relayAuth === "boolean") contentSettings.setRelayAuth(settings.relayAuth);
  if (settings.zapAmount != null || settings.zapMsg != null || Array.isArray(settings.zapPresets)) {
    saveZapSettings({
      ...(settings.zapAmount != null ? { amount: settings.zapAmount } : {}),
      ...(settings.zapMsg != null ? { msg: settings.zapMsg } : {}),
      ...(Array.isArray(settings.zapPresets) ? { presets: settings.zapPresets } : {}),
    });
  }
}

/**
 * Mirrors the local-only appearance/content/zap settings hooks to a single
 * self-encrypted (NIP-44) NIP-78 (kind 30078) app-data event, so they persist
 * across devices. Wallet settings are intentionally excluded (credential, not
 * a preference).
 */
export default function useAppSettingsSync({
  pubkey, signAndPublish,
  dark, setDark,
  textSize, setTextSize,
  contentSettings,
  zapSettings, saveZapSettings,
}) {
  const [settled, setSettled] = useState(false);
  // Snapshot (as published or as just loaded from relays) known to already
  // match the relay copy — publishing is skipped until the live snapshot
  // diverges from this, so hydration never immediately re-publishes itself.
  const syncedSnapshotRef = useRef(null);

  useEffect(() => {
    const pk = normPubkey(pubkey);
    setSettled(false);
    syncedSnapshotRef.current = null;
    if (!isHexPubkey(pk)) return;

    let cancelled = false;
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
    const received = [];

    const applyRemote = async raw => {
      let plain = null;
      if (!hasNip44()) {
        for (let i = 0; i < 6 && !cancelled && !hasNip44(); i++) await new Promise(r => setTimeout(r, 500));
      }
      if (cancelled || !hasNip44()) return;
      try { plain = await window.nostr.nip44.decrypt(raw.pubkey, raw.content); } catch { return; }
      if (cancelled || !plain) return;

      let parsed;
      try { parsed = JSON.parse(plain); } catch { return; }
      if (cancelled) return;

      // Merge over the current local snapshot (not just dark/textSize) so the
      // "synced" record we compare future renders against exactly matches what
      // applySnapshot is about to write into the local hooks' state — using a
      // partial/stale base here would make the very next render look diverged
      // and trigger a spurious immediate re-publish.
      const remoteSnapshot = { ...buildSnapshot({ dark, textSize, contentSettings, zapSettings }), ...parsed };
      const localDark = readStoredDarkPreference();
      const keepLocalDark = typeof parsed.dark === "boolean"
        && isLocalDarkPreferenceNewer(localDark.updatedAt, raw.created_at);
      const appliedSnapshot = keepLocalDark
        ? { ...remoteSnapshot, dark: localDark.dark }
        : remoteSnapshot;

      applySnapshot(appliedSnapshot, { setDark, setTextSize, contentSettings, saveZapSettings });
      // Keep the relay snapshot as the comparison target when a newer local
      // theme wins, so the publish effect sends that preference upstream.
      syncedSnapshotRef.current = JSON.stringify(remoteSnapshot);
    };

    const sub = pool.request(relayUrls, [
      { kinds: [SETTINGS_KIND], authors: [pk], "#d": [SETTINGS_D_TAG] },
    ]).subscribe({
      next: raw => { eventStore.add(raw); received.push(raw); },
      complete: async () => {
        if (cancelled) return;
        let latest = null;
        for (const ev of received) if (!latest || ev.created_at > latest.created_at) latest = ev;
        if (latest) await applyRemote(latest);
        if (!cancelled) setSettled(true);
      },
      error: () => { if (!cancelled) setSettled(true); },
    });

    const cutoffTimer = setTimeout(() => { if (!cancelled) setSettled(true); }, SETTLE_CUTOFF_MS);

    return () => { cancelled = true; clearTimeout(cutoffTimer); sub.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey]);

  const snapshot = buildSnapshot({ dark, textSize, contentSettings, zapSettings });
  const snapshotKey = JSON.stringify(snapshot);

  useEffect(() => {
    const pk = normPubkey(pubkey);
    if (!isHexPubkey(pk) || !signAndPublish) return;
    if (!settled) return;
    if (snapshotKey === syncedSnapshotRef.current) return;
    if (!hasNip44()) return;

    const timer = setTimeout(async () => {
      try {
        const encrypted = await window.nostr.nip44.encrypt(pk, snapshotKey);
        await signAndPublish({
          kind: SETTINGS_KIND,
          content: encrypted,
          tags: [["d", SETTINGS_D_TAG]],
        });
        syncedSnapshotRef.current = snapshotKey;
      } catch { /* will retry on the next settings change */ }
    }, PUBLISH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [pubkey, signAndPublish, settled, snapshotKey]);
}
