export default function Overlay({ children, onDismiss, centered = false, compose = false, className = "", noClickOutside = false }) {
  return (
    <div
      className={`overlay${centered ? " centered" : ""}${compose ? " compose-overlay" : ""}${className ? ` ${className}` : ""}`}
      onClick={e => { if (e.target === e.currentTarget) { e.stopPropagation(); if (!noClickOutside) onDismiss?.(); } }}
    >
      {children}
    </div>
  );
}
