import { useState, useCallback } from "react";

const KEY = "circl_zap_settings";
const DEFAULTS = { amount: 21, msg: "" };

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
