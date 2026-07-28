import { useState, useEffect, useCallback } from "react";

export default function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("circl_dark") === "1"; } catch { return false; }
  });

  useEffect(() => {
    const root = document.documentElement;
    dark ? root.classList.add("dark") : root.classList.remove("dark");
    try { localStorage.setItem("circl_dark", dark ? "1" : "0"); } catch {}
  }, [dark]);

  const toggle = useCallback(() => setDark(d => !d), []);
  return { dark, toggle, setDark };
}
