import { useState, useCallback } from "react";
import { ZAP_PRESETS } from "../constants.js";

const KEY = "circl_zap_settings";
const DEFAULT_PRESETS = ZAP_PRESETS.map(p => p.sats);
const DEFAULTS = { amount: 21, msg: "", presets: DEFAULT_PRESETS };

export function getZapPresets() {
  try {
    const s = localStorage.getItem(KEY);
    const saved = s ? JSON.parse(s) : null;
    if (Array.isArray(saved?.presets) && saved.presets.length) return saved.presets;
  } catch {}
  return DEFAULT_PRESETS;
}

export default function useZapSettings() {
  const [zapSettings, setZapSettings] = useState(() => {
    try {
      const s = localStorage.getItem(KEY);
      return s ? { ...DEFAULTS, ...JSON.parse(s) } : { ...DEFAULTS };
    } catch { return { ...DEFAULTS }; }
  });

  const saveZapSettings = useCallback(updates => {
    setZapSettings(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { zapSettings, saveZapSettings };
}
