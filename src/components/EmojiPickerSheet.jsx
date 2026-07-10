import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Overlay from "./Overlay.jsx";
import { sheetPortal } from "../utils/sheetPortal.js";
import EmojiPicker from "./EmojiPicker.jsx";

function DesktopPopover({ triggerRect, onDismiss, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onDismiss?.();
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [onDismiss]);

  const POPOVER_WIDTH  = 380;
  const POPOVER_HEIGHT = 400;
  const gap = 8;
  const spaceBelow = window.innerHeight - triggerRect.bottom - gap;
  const top  = spaceBelow >= POPOVER_HEIGHT
    ? triggerRect.bottom + gap
    : Math.max(gap, triggerRect.top - POPOVER_HEIGHT - gap);
  const left = Math.max(gap, Math.min(
    triggerRect.left + triggerRect.width / 2 - POPOVER_WIDTH / 2,
    window.innerWidth - POPOVER_WIDTH - gap
  ));

  return (
    <div
      ref={ref}
      className="ep-popover"
      style={{ top, left }}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export default function EmojiPickerSheet({ onPick, onDismiss, customEmojis, triggerRect }) {
  const isDesktop = triggerRect && window.matchMedia("(pointer: fine)").matches;

  const picker = (
    <EmojiPicker
      customEmojis={customEmojis}
      onSelect={emoji => { onPick?.(emoji); onDismiss?.(); }}
    />
  );

  if (isDesktop) {
    return createPortal(
      <DesktopPopover triggerRect={triggerRect} onDismiss={onDismiss}>
        {picker}
      </DesktopPopover>,
      document.body
    );
  }

  return createPortal(
    <Overlay onDismiss={onDismiss}>
      <div className="emoji-reaction-sheet" onClick={e => e.stopPropagation()}>
        {picker}
      </div>
    </Overlay>,
    sheetPortal()
  );
}
