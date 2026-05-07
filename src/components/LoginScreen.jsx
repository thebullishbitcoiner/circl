import { Ky } from "./icons.jsx";

export default function LoginScreen({ onLogin, status, error }) {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-logo">Circl</div>
        <div className="login-tagline">Your follows. Your signal.<br />Nothing else.</div>
        <div className="login-features">
          {[
            { icon: "⚡", text: "Feed from your follow list — no algorithm" },
            { icon: "📖", text: "Longform NIP-23 articles rendered beautifully" },
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
          <Ky s={15} />{status === "checking" ? "Connecting…" : "Connect with Nostr extension"}
        </button>
        {error && <div style={{ color: "#E05C8A", fontSize: 12, marginTop: 8, textAlign: "center" }}>{error}</div>}
        <div className="login-note">
          NIP-07 · Your private key never leaves the extension<br />
          <a href="https://getalby.com" target="_blank" rel="noreferrer">Get Alby →</a>
        </div>
        <div className="login-version-footer">{__APP_VERSION__}</div>
      </div>
    </div>
  );
}
