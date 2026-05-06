import { useState } from "react";

function RizfulConnect({ pubkey, onConnected }) {
  const [step,     setStep]   = useState("idle");
  const [code,     setCode]   = useState("");
  const [errorMsg, setErrMsg] = useState("");
  const RIZFUL_ORIGIN = "https://rizful.com";

  const openSignup   = () => window.open(`${RIZFUL_ORIGIN}/create-account`, "_blank", "width=480,height=640");
  const openCodePage = () => { window.open(`${RIZFUL_ORIGIN}/nostr_onboarding_auth_token/new`, "_blank", "width=480,height=640"); setStep("code"); };

  const exchange = async () => {
    if (!code.trim()) return;
    setStep("exchanging"); setErrMsg("");
    try {
      const res = await fetch(`${RIZFUL_ORIGIN}/nostr_onboarding_auth_token/post_for_secrets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret_code: code.trim(), nostr_public_key: pubkey }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (!data.nwc_uri) throw new Error("No NWC URI in response");
      onConnected(data);
      setStep("done");
    } catch (e) {
      setErrMsg(e.message || "Connection failed.");
      setStep("error");
    }
  };

  if (step === "done") return null;

  const btnStyle = (active) => ({
    width: "100%", padding: "9px 0", borderRadius: 10,
    border: active ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
    background: active ? "var(--primary)" : "var(--surface)",
    color: active ? "white" : "var(--text)",
    cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans',sans-serif", fontWeight: active ? 600 : 500,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .15s",
  });

  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>1</div>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "'DM Sans',sans-serif" }}>Create a Rizful account</span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif" }}>optional</span>
        </div>
        <button onClick={openSignup} style={btnStyle(false)}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
          Open rizful.com
        </button>
      </div>
      <div style={{ borderTop: "1px solid var(--border)", marginBottom: 20 }} />
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>2</div>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "'DM Sans',sans-serif" }}>Authorization Code Generation</span>
        </div>
        <button onClick={openCodePage} style={btnStyle(step === "idle")}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          {step === "idle" ? "Get Code" : "Get a new code"}
        </button>
      </div>
      {(step === "code" || step === "exchanging" || step === "error") && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>3</div>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "'DM Sans',sans-serif" }}>Paste your code</span>
          </div>
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="Paste one-time code here…"
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${errorMsg ? "#E05C8A" : "var(--border)"}`, background: "var(--bg)", color: "var(--text)", fontFamily: "monospace", fontSize: 13, outline: "none", marginBottom: 8 }} />
          {errorMsg && <div style={{ fontSize: 11, color: "#E05C8A", marginBottom: 8, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.4 }}>{errorMsg}</div>}
          <button onClick={exchange} disabled={!code.trim() || step === "exchanging"}
            style={{ ...btnStyle(code.trim() && step !== "exchanging"), opacity: !code.trim() || step === "exchanging" ? 0.5 : 1 }}>
            {step === "exchanging"
              ? <><div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(255,255,255,.4)", borderTopColor: "white", animation: "spin .6s linear infinite" }} /> Connecting…</>
              : "⚡ Connect wallet"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage({ onBack, dark, toggleDark, onLogout, pubkey, wallet, onWalletConnected, onWalletDisconnect }) {
  return (
    <div className="slide-panel-scroll">
      <div className="feed-header" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="feed-title">Settings</div>
      </div>

      <div className="settings-section-title">⚡ Lightning Wallet</div>
      {wallet?.nwc_uri ? (
        <>
          <div style={{ margin: "0 16px 4px", padding: "14px 16px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4CAF50", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", fontFamily: "'DM Sans',sans-serif" }}>Wallet connected</span>
            </div>
            {wallet.lightning_address && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={2}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.13 6.13l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--primary)" }}>{wallet.lightning_address}</span>
              </div>
            )}
          </div>
          <div className="settings-row" style={{ marginTop: 4 }} onClick={onWalletDisconnect}>
            <div className="settings-row-label" style={{ color: "#E05C8A" }}>Disconnect wallet</div>
          </div>
        </>
      ) : (
        <div style={{ margin: "0 16px 4px", padding: "14px 16px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, margin: "0 0 12px" }}>
            Connect a Lightning wallet to send real zaps. Powered by <span style={{ color: "var(--primary)", fontWeight: 500 }}>Rizful</span>.
          </p>
          <RizfulConnect pubkey={pubkey} onConnected={onWalletConnected} />
        </div>
      )}

      <div className="settings-section-title" style={{ marginTop: 16 }}>Appearance</div>
      <div className="settings-row" onClick={toggleDark}>
        <div>
          <div className="settings-row-label">Dark mode</div>
          <div className="settings-row-sub">Switch between light and dark theme</div>
        </div>
        <label className="toggle" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={dark} onChange={toggleDark} />
          <div className="toggle-track" />
          <div className="toggle-thumb" />
        </label>
      </div>

      <div className="settings-section-title">Account</div>
      <div className="settings-row" onClick={onLogout}>
        <div className="settings-row-label" style={{ color: "#E05C8A" }}>Sign out</div>
      </div>
    </div>
  );
}
