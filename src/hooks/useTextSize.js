import { useState, useEffect } from "react";

const SIZES = { small: "12px", medium: "14px", large: "16px" };

export default function useTextSize() {
  const [textSize, setTextSize] = useState(() => {
    try { return localStorage.getItem("circl_text_size") || "medium"; } catch { return "medium"; }
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--font-base", SIZES[textSize] || "14px");
    try { localStorage.setItem("circl_text_size", textSize); } catch {}
  }, [textSize]);

  return { textSize, setTextSize };
}
