import { useRef, useCallback } from "react";

export default function useLongPress(onLongPress, onClick, delay = 500) {
  const timer = useRef(null);
  const fired = useRef(false);

  const start = useCallback(e => {
    e.stopPropagation();
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress?.();
    }, delay);
  }, [onLongPress, delay]);

  const cancel = useCallback(() => clearTimeout(timer.current), []);

  const end = useCallback(e => {
    e.stopPropagation();
    clearTimeout(timer.current);
    if (!fired.current) onClick?.();
  }, [onClick]);

  return {
    onMouseDown: start, onMouseUp: end, onMouseLeave: cancel,
    onTouchStart: start, onTouchEnd: end,
  };
}
