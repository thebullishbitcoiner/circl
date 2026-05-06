import { useRef, useCallback } from "react";

export default function useSwipe(onSwipeRight, onSwipeLeft) {
  const startX = useRef(null);
  const startY = useRef(null);

  const onTouchStart = useCallback(e => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback(e => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = e.changedTouches[0].clientY - startY.current;
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 48) {
      if (dx > 0) onSwipeRight?.();
      else        onSwipeLeft?.();
    }
    startX.current = null;
    startY.current = null;
  }, [onSwipeRight, onSwipeLeft]);

  return { onTouchStart, onTouchEnd };
}
