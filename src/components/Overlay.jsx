export default function Overlay({ children, onDismiss, centered = false, compose = false }) {
  return (
    <div
      className={`overlay${centered ? " centered" : ""}${compose ? " compose-overlay" : ""}`}
      onClick={e => { if (e.target === e.currentTarget) onDismiss?.(); }}
    >
      {children}
    </div>
  );
}
