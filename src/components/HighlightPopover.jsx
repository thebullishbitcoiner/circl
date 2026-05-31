import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

export default function HighlightPopover({ sourceEvent, onHighlight, containerRef }) {
  const [pos, setPos] = useState(null);
  const pendingRef = useRef(null);

  const check = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 3) { setPos(null); return; }

    // Make sure selection is inside our container
    if (containerRef?.current) {
      const anchor = sel.anchorNode;
      if (!containerRef.current.contains(anchor)) { setPos(null); return; }
    }

    const range = sel.getRangeAt(0);
    const rect  = range.getBoundingClientRect();
    if (!rect.width && !rect.height) { setPos(null); return; }

    const context = sel.anchorNode?.textContent?.trim() ?? "";
    setPos({ x: rect.left + rect.width / 2, y: rect.top + window.scrollY, text, context });
  }, [containerRef]);

  useEffect(() => {
    const onUp = () => {
      clearTimeout(pendingRef.current);
      pendingRef.current = setTimeout(check, 50);
    };
    const onDown = () => { setPos(null); };

    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      clearTimeout(pendingRef.current);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [check]);

  if (!pos) return null;

  return createPortal(
    <button
      type="button"
      className="highlight-popover-btn"
      style={{ left: pos.x, top: pos.y - 40 }}
      onMouseDown={e => {
        e.preventDefault();
        e.stopPropagation();
        const { text, context } = pos;
        setPos(null);
        window.getSelection()?.removeAllRanges();
        onHighlight?.({ text, context, sourceEvent });
      }}
    >
      ✦ Highlight
    </button>,
    document.body
  );
}
