import { useState, useEffect, useCallback } from "react";

const DARK_STORAGE_KEY = "circl_dark";
const DARK_UPDATED_AT_STORAGE_KEY = "circl_dark_updated_at";

export function readStoredDarkPreference() {
  try {
    const updatedAt = Number(localStorage.getItem(DARK_UPDATED_AT_STORAGE_KEY));
    return {
      dark: localStorage.getItem(DARK_STORAGE_KEY) === "1",
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
    };
  } catch {
    return { dark: false, updatedAt: 0 };
  }
}

export function isLocalDarkPreferenceNewer(localUpdatedAt, remoteCreatedAt) {
  return localUpdatedAt > remoteCreatedAt * 1000;
}

function storeDarkPreference(dark, updatedAt) {
  try {
    localStorage.setItem(DARK_STORAGE_KEY, dark ? "1" : "0");
    if (updatedAt != null) {
      localStorage.setItem(DARK_UPDATED_AT_STORAGE_KEY, String(updatedAt));
    }
  } catch {}
}

export default function useDarkMode() {
  const [dark, setDark] = useState(() => readStoredDarkPreference().dark);

  useEffect(() => {
    const root = document.documentElement;
    dark ? root.classList.add("dark") : root.classList.remove("dark");
    storeDarkPreference(dark);
  }, [dark]);

  const toggle = useCallback(() => {
    const next = !dark;
    storeDarkPreference(next, Date.now());
    setDark(next);
  }, [dark]);

  return { dark, toggle, setDark };
}
