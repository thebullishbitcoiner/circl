import { createPortal } from "react-dom";

export default function Overlay({ children, onDismiss, centered = false, compose = false, className = "", noClickOutside = false }) {
  if (!centered) {
    const handleBackdrop = () => { if (!noClickOutside) onDismiss?.(); };
    return (
      <>
        {createPortal(
          <div className="overlay-backdrop" onClick={handleBackdrop} />,
          document.body
        )}
        <div className={`overlay-positioner${compose ? " compose-overlay" : ""}`}>
          {children}
        </div>
      </>
    );
  }

  return (
    <div
      className={`overlay centered${className ? ` ${className}` : ""}`}
      onClick={e => { if (e.target === e.currentTarget) { e.stopPropagation(); if (!noClickOutside) onDismiss?.(); } }}
    >
      {children}
    </div>
  );
}
