export default function LoginScreen({ onLogin, status, error }) {
  const features = [
    { icon: "🎯", color: "#0EA5E9", bg: "rgba(14,165,233,.13)", title: "One Feed", desc: "Focused on keeping in touch with your follows" },
    { icon: "📡", color: "#6D28D9", bg: "rgba(109,40,217,.13)", title: "Advanced Relay Support", desc: "Configure different relay lists to ensure the best Nostr experience" },
    { icon: "🔒", color: "#3B82F6", bg: "rgba(59,130,246,.13)", title: "Private Bookmarks and Mutes", desc: "Encrypted via NIP-44" },
    { icon: "🤝", color: "#10B981", bg: "rgba(16,185,129,.13)", title: "Interactions", desc: "A dedicated \"Between Us\" profile tab to see past interactions" },
    { icon: "🌐", color: "#F59E0B", bg: "rgba(245,158,11,.13)", title: "Outbox Model", desc: "Promote decentralization by reading/writing from other users' configured relays" },
    { icon: "🎨", color: "#EC4899", bg: "rgba(236,72,153,.13)", title: "Express Yourself", desc: "GIFs and custom emojis supported throughout the app" },
  ];

  return (
    <div className="login-page">
      <section className="login-hero-section">
        <div className="login-topbar">
          <div className="login-topbar-logo">
            <img src="/logo.png" alt="Circl" style={{ height: 26, width: "auto" }} />
            <span className="login-topbar-name">Circl</span>
          </div>
        </div>

        <div className="login-hero-content">
<h1 className="login-headline">
            Your circle.<br />
            <span className="login-headline-gradient">Your signal.</span><br />
            Nothing else.
          </h1>
          <p className="login-subhead">
            A client built to keep in touch with your circle.<br />No algorithm. No noise.
          </p>
          <button className="login-cta-btn" onClick={onLogin} disabled={status === "checking"}>
            {status === "checking" ? "Connecting…" : "Login with Nostr"}
          </button>
          {error && <div className="login-error">{error}</div>}
          <div className="login-note">
            Requires a NIP-07 extension like{" "}
            <a href="https://getalby.com/alby-extension" target="_blank" rel="noreferrer">Alby</a>,{" "}
            <a
              href="https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp"
              target="_blank"
              rel="noreferrer"
            >
              nos2x
            </a>, or{" "}
            <a href="https://sidecar.top/" target="_blank" rel="noreferrer">Sidecar</a>.
          </div>
        </div>

        <div className="login-scroll-hint">↓</div>
      </section>

      <section className="login-features-section">
        <h2 className="login-features-heading">What makes Circl different</h2>
        <div className="login-grid">
          {features.map((f, i) => (
            <div className="login-feat" key={i}>
              <div className="login-feat-icon" style={{ background: f.bg, color: f.color }}>{f.icon}</div>
              <div className="login-feat-title">{f.title}</div>
              <div className="login-feat-desc">{f.desc}</div>
            </div>
          ))}
        </div>
        <div className="login-version-footer">{__APP_VERSION__}</div>
      </section>
    </div>
  );
}
