import useSwipe from "../hooks/useSwipe.js";

export default function SwipePanel({ open, onSwipeRight, children }) {
  const { onTouchStart, onTouchEnd } = useSwipe(onSwipeRight);
  return (
    <div
      className={`slide-panel ${open ? "open" : ""}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
}
