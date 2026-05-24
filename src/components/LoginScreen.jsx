export default function LoginScreen({ onLogin, status, error }) {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-logo"><img src="/logo.png" alt="Circl" style={{ height: 80, width: "auto" }} /></div>
        <div className="login-tagline">Your circle. Your signal.<br />Nothing else.</div>
        <div className="login-features">
          {[
            { icon: "⚡", text: "Feed from your follow list — no algorithm" },
            { icon: "💬", text: "See conversations between you and your follows" },
            { icon: "🔖", text: "Private bookmarks via NIP-44 encryption" },
          ].map((f, i) => (
            <div className="login-feature" key={i}>
              <div className="login-feature-icon">{f.icon}</div>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
        <div className="login-divider" />
        <button className="login-btn" onClick={onLogin} disabled={status === "checking"}>
          {status === "checking" ? "Connecting…" : "Login with Nostr"}
        </button>
        {error && <div style={{ color: "#E05C8A", fontSize: 12, marginTop: 8, textAlign: "center" }}>{error}</div>}
        <div className="login-note">
          Requires a NIP-07 extension like nos2x or keys.band
        </div>
        <div className="login-version-footer">{__APP_VERSION__}</div>
      </div>
    </div>
  );
}
