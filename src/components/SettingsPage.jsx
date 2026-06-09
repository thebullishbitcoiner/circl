import { useState } from "react";
import useMailboxes from "../hooks/useMailboxes.js";
import { MailboxesFactory } from "applesauce-core";
import CustomEmojiSettingsPage from "./CustomEmojiSettingsPage.jsx";

// ── Wallet helpers ────────────────────────────────────────────────────────────

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
    <div style={{ padding: "4px 20px 16px" }}>
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

function NWCConnect({ onConnected }) {
  const [uri,   setUri]   = useState("");
  const [error, setError] = useState("");

  const connect = () => {
    const trimmed = uri.trim();
    if (!trimmed.startsWith("nostr+walletconnect://")) {
      setError("Must start with nostr+walletconnect://");
      return;
    }
    try {
      const url = new URL(trimmed);
      const lud16 = url.searchParams.get("lud16") || null;
      onConnected({ nwc_uri: trimmed, lightning_address: lud16 });
    } catch {
      setError("Invalid connection string");
    }
  };

  const btnStyle = (active) => ({
    width: "100%", padding: "9px 0", borderRadius: 10,
    border: active ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
    background: active ? "var(--primary)" : "var(--surface)",
    color: active ? "white" : "var(--text)",
    cursor: active ? "pointer" : "default",
    fontSize: 13, fontFamily: "'DM Sans',sans-serif", fontWeight: active ? 600 : 500,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .15s",
    opacity: active ? 1 : 0.5,
  });

  return (
    <div style={{ padding: "4px 20px 16px" }}>
      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, margin: "0 0 12px" }}>
        Paste a connection string from any NWC-compatible wallet.
      </p>
      <textarea
        value={uri}
        onChange={e => { setUri(e.target.value); setError(""); }}
        placeholder="nostr+walletconnect://..."
        rows={3}
        style={{
          width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
          border: `1.5px solid ${error ? "#E05C8A" : "var(--border)"}`,
          background: "var(--bg)", color: "var(--text)", fontFamily: "monospace", fontSize: 12,
          outline: "none", resize: "none", marginBottom: 8, lineBreak: "anywhere",
        }}
      />
      {error && <div style={{ fontSize: 11, color: "#E05C8A", marginBottom: 8, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.4 }}>{error}</div>}
      <button onClick={connect} disabled={!uri.trim()} style={btnStyle(!!uri.trim())}>
        ⚡ Connect wallet
      </button>
    </div>
  );
}

// ── Relay editor ──────────────────────────────────────────────────────────────

function normalizeRelayUrl(input) {
  const s = (input || "").trim();
  if (!s) return null;
  const withScheme = s.startsWith("wss://") || s.startsWith("ws://") ? s : `wss://${s}`;
  try { new URL(withScheme); return withScheme; } catch { return null; }
}

function RelayEditor({ pubkey, signAndPublish }) {
  const { inboxes, outboxes } = useMailboxes(pubkey);
  const [localInboxes, setLocalInboxes] = useState(null);
  const [localOutboxes, setLocalOutboxes] = useState(null);
  const [inboxInput, setInboxInput] = useState("");
  const [outboxInput, setOutboxInput] = useState("");
  const [saving, setSaving] = useState(false);

  const effectiveInboxes = localInboxes ?? inboxes;
  const effectiveOutboxes = localOutboxes ?? outboxes;

  async function publish(nextInboxes, nextOutboxes) {
    if (!signAndPublish) return;
    setSaving(true);
    try {
      const template = await MailboxesFactory.create({ inboxes: nextInboxes, outboxes: nextOutboxes });
      await signAndPublish(template);
    } finally {
      setSaving(false);
    }
  }

  function addInbox() {
    const url = normalizeRelayUrl(inboxInput);
    if (!url || effectiveInboxes.includes(url)) return;
    const next = [...effectiveInboxes, url];
    setLocalInboxes(next);
    setInboxInput("");
    publish(next, effectiveOutboxes);
  }

  function removeInbox(url) {
    const next = effectiveInboxes.filter(r => r !== url);
    setLocalInboxes(next);
    publish(next, effectiveOutboxes);
  }

  function addOutbox() {
    const url = normalizeRelayUrl(outboxInput);
    if (!url || effectiveOutboxes.includes(url)) return;
    const next = [...effectiveOutboxes, url];
    setLocalOutboxes(next);
    setOutboxInput("");
    publish(effectiveInboxes, next);
  }

  function removeOutbox(url) {
    const next = effectiveOutboxes.filter(r => r !== url);
    setLocalOutboxes(next);
    publish(effectiveInboxes, next);
  }

  const fmtUrl = url => url.replace(/^wss?:\/\//, "").replace(/\/$/, "");

  function RelaySection({ title, relays, input, onInputChange, onAdd, onRemove, onKeyDown }) {
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <span style={{
            fontSize: "calc(var(--font-base) - 3px)", fontWeight: 700,
            color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif",
            textTransform: "uppercase", letterSpacing: "0.07em",
          }}>{title}</span>
          <span style={{
            fontSize: "calc(var(--font-base) - 4px)", color: "var(--text-faint)",
            fontFamily: "'DM Sans',sans-serif", background: "var(--bg)",
            border: "1px solid var(--border)", borderRadius: 20, padding: "1px 7px",
          }}>{relays.length}</span>
        </div>
        {relays.length === 0 ? (
          <div style={{ fontSize: "calc(var(--font-base) - 2px)", color: "var(--text-faint)", fontFamily: "monospace", padding: "6px 0" }}>None configured</div>
        ) : relays.map((r, i) => (
          <div key={r} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < relays.length - 1 ? "1px solid var(--border)" : "none" }}>
            <span style={{ fontFamily: "monospace", fontSize: "calc(var(--font-base) - 2px)", color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtUrl(r)}</span>
            <button onClick={() => onRemove(r)} disabled={saving}
              style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-faint)", fontSize: "calc(var(--font-base) + 2px)", fontFamily: "'DM Sans',sans-serif", cursor: saving ? "default" : "pointer", lineHeight: 1, flexShrink: 0, opacity: saving ? 0.5 : 1 }}>×</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <input value={input} onChange={e => onInputChange(e.target.value)} onKeyDown={onKeyDown}
            placeholder="relay.example.com" disabled={saving}
            style={{ flex: 1, padding: "0 10px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "monospace", fontSize: "calc(var(--font-base) - 2px)", outline: "none", minWidth: 0, opacity: saving ? 0.5 : 1, height: "calc(var(--font-base) + 20px)", boxSizing: "border-box" }} />
          <button onClick={onAdd} disabled={saving}
            style={{ padding: "0 14px", borderRadius: 8, border: "none", background: "var(--primary)", color: "white", fontFamily: "'DM Sans',sans-serif", fontSize: "calc(var(--font-base) - 2px)", fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1, flexShrink: 0, height: "calc(var(--font-base) + 20px)" }}>Add</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px" }}>
      <RelaySection title="Read" relays={effectiveInboxes} input={inboxInput} onInputChange={setInboxInput} onAdd={addInbox} onKeyDown={e => e.key === "Enter" && addInbox()} onRemove={removeInbox} />
      <RelaySection title="Write" relays={effectiveOutboxes} input={outboxInput} onInputChange={setOutboxInput} onAdd={addOutbox} onKeyDown={e => e.key === "Enter" && addOutbox()} onRemove={removeOutbox} />
      {saving && <div style={{ fontSize: "calc(var(--font-base) - 3px)", color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", textAlign: "center", paddingTop: 2 }}>Publishing…</div>}
    </div>
  );
}

// ── Sub-page shell ────────────────────────────────────────────────────────────

function SubPage({ title, onBack, children }) {
  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <button type="button" onClick={onBack}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 20, lineHeight: 1, padding: "0 8px 0 0" }}
          aria-label="Back">‹</button>
        <span className="feed-title">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Sub-pages ─────────────────────────────────────────────────────────────────

function WalletSubPage({ onBack, pubkey, wallet, onWalletConnected, onWalletDisconnect }) {
  const [walletTab, setWalletTab] = useState("rizful");

  const tabBtn = (id) => ({
    flex: 1, padding: "6px 0", borderRadius: 6, border: "none",
    background: walletTab === id ? "var(--bg)" : "transparent",
    color: walletTab === id ? "var(--primary)" : "var(--text-muted)",
    fontFamily: "'DM Sans',sans-serif", fontSize: 12,
    fontWeight: walletTab === id ? 600 : 500,
    cursor: "pointer",
    boxShadow: walletTab === id ? "0 1px 4px rgba(0,0,0,.12)" : "none",
    transition: "all .15s",
  });

  return (
    <SubPage title="Wallet" onBack={onBack}>
      {wallet?.nwc_uri ? (
        <>
          <div style={{ margin: "12px 16px 4px", padding: "14px 16px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4CAF50", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", fontFamily: "'DM Sans',sans-serif" }}>Wallet connected</span>
              {wallet.source && (
                <span style={{ fontSize: 10, color: "var(--text-faint)", background: "var(--bg)", borderRadius: 4, padding: "2px 6px", marginLeft: "auto", fontFamily: "'DM Sans',sans-serif", border: "1px solid var(--border)" }}>
                  via {wallet.source === "rizful" ? "Rizful" : "NWC"}
                </span>
              )}
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
        <div style={{ margin: "12px 16px 4px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ display: "flex", padding: "10px 12px 10px", gap: 4 }}>
            <div style={{ display: "flex", flex: 1, background: "var(--border)", borderRadius: 8, padding: 3, gap: 2 }}>
              <button style={tabBtn("rizful")} onClick={() => setWalletTab("rizful")}>Rizful</button>
              <button style={tabBtn("nwc")}    onClick={() => setWalletTab("nwc")}>NWC Connection String</button>
            </div>
          </div>
          {walletTab === "rizful"
            ? <RizfulConnect pubkey={pubkey} onConnected={data => onWalletConnected({ ...data, source: "rizful" })} />
            : <NWCConnect onConnected={data => onWalletConnected({ ...data, source: "nwc" })} />
          }
        </div>
      )}
    </SubPage>
  );
}

function ZapsSubPage({ onBack, zapSettings, onSaveZapSettings }) {
  const [zapAmount, setZapAmount] = useState(String(zapSettings.amount));
  const [zapMsg,    setZapMsg]    = useState(zapSettings.msg);

  const inputStyle = {
    padding: "6px 10px", borderRadius: 8,
    border: "1.5px solid var(--border)", background: "var(--bg)",
    color: "var(--text)", fontFamily: "'DM Sans',sans-serif",
    fontSize: 13, outline: "none",
  };

  const handleAmountChange = e => {
    const raw = e.target.value;
    setZapAmount(raw);
    const parsed = parseInt(raw);
    if (parsed >= 1) onSaveZapSettings?.({ amount: parsed, msg: zapMsg });
  };

  const handleAmountBlur = () => {
    const amount = Math.max(1, parseInt(zapAmount) || 21);
    setZapAmount(String(amount));
    onSaveZapSettings?.({ amount, msg: zapMsg });
  };

  const handleMsgChange = e => {
    setZapMsg(e.target.value);
    const parsed = Math.max(1, parseInt(zapAmount) || 21);
    onSaveZapSettings?.({ amount: parsed, msg: e.target.value });
  };

  return (
    <SubPage title="Zaps" onBack={onBack}>
      <div style={{ margin: "12px 16px 4px", padding: "14px 16px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", fontFamily: "'DM Sans',sans-serif" }}>Zap Defaults</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <label style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", flexShrink: 0 }}>Amount (sats)</label>
            <input type="number" min="1" value={zapAmount} onChange={handleAmountChange} onBlur={handleAmountBlur}
              style={{ ...inputStyle, width: 90, textAlign: "right", fontFamily: "monospace" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <label style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", flexShrink: 0 }}>Message</label>
            <input type="text" value={zapMsg} onChange={handleMsgChange} placeholder="optional"
              style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
          </div>
        </div>
      </div>
    </SubPage>
  );
}

function AppearanceSubPage({ onBack, dark, toggleDark, textSize, onTextSizeChange }) {
  return (
    <SubPage title="Appearance" onBack={onBack}>
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
      <div className="settings-row" style={{ alignItems: "center" }}>
        <div>
          <div className="settings-row-label">Text size</div>
          <div className="settings-row-sub">Adjust the base font size</div>
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", borderRadius: 8, padding: 3 }}>
          {[["small", "S"], ["medium", "M"], ["large", "L"]].map(([size, label]) => (
            <button key={size} onClick={e => { e.stopPropagation(); onTextSizeChange?.(size); }}
              style={{
                padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                background: textSize === size ? "var(--bg)" : "transparent",
                color: textSize === size ? "var(--text)" : "var(--text-faint)",
                fontFamily: "'DM Sans',sans-serif", fontSize: 12,
                fontWeight: textSize === size ? 600 : 400,
                boxShadow: textSize === size ? "0 1px 3px rgba(0,0,0,.1)" : "none",
                transition: "all .15s",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </SubPage>
  );
}

function RelaysSubPage({ onBack, pubkey, signAndPublish }) {
  return (
    <SubPage title="Relays" onBack={onBack}>
      <div style={{ marginTop: 12 }}>
        <RelayEditor pubkey={pubkey} signAndPublish={signAndPublish} />
      </div>
    </SubPage>
  );
}

// ── Main settings page ────────────────────────────────────────────────────────

export default function SettingsPage({
  onBack, dark, toggleDark, onLogout, pubkey, wallet, onWalletConnected, onWalletDisconnect,
  zapSettings = { amount: 21, msg: "" }, onSaveZapSettings,
  textSize = "medium", onTextSizeChange,
  signAndPublish,
  customEmojis, sets = [], addEmoji, removeEmoji, addSet, removeSet, customEmojiLoading,
}) {
  const [subPage, setSubPage] = useState(null);

  if (subPage === "wallet") {
    return <WalletSubPage onBack={() => setSubPage(null)} pubkey={pubkey} wallet={wallet} onWalletConnected={onWalletConnected} onWalletDisconnect={onWalletDisconnect} />;
  }
  if (subPage === "zaps") {
    return <ZapsSubPage onBack={() => setSubPage(null)} zapSettings={zapSettings} onSaveZapSettings={onSaveZapSettings} />;
  }
  if (subPage === "appearance") {
    return <AppearanceSubPage onBack={() => setSubPage(null)} dark={dark} toggleDark={toggleDark} textSize={textSize} onTextSizeChange={onTextSizeChange} />;
  }
  if (subPage === "relays") {
    return <RelaysSubPage onBack={() => setSubPage(null)} pubkey={pubkey} signAndPublish={signAndPublish} />;
  }
  if (subPage === "customEmoji") {
    return (
      <CustomEmojiSettingsPage
        emojis={customEmojis} sets={sets}
        addEmoji={addEmoji} removeEmoji={removeEmoji}
        addSet={addSet} removeSet={removeSet}
        loading={customEmojiLoading}
        onBack={() => setSubPage(null)}
      />
    );
  }

  const walletSub = wallet?.nwc_uri
    ? (wallet.lightning_address ? wallet.lightning_address : "Connected")
    : "Not connected";

  const totalEmojiCount = (customEmojis?.length ?? 0) + sets.reduce((n, s) => n + s.emojis.length, 0);

  return (
    <div className="slide-panel-scroll">
      <div className="feed-header" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="feed-title">Settings</div>
      </div>

      <div className="settings-row" onClick={() => setSubPage("wallet")}>
        <div>
          <div className="settings-row-label">Wallet</div>
          <div className="settings-row-sub">{walletSub}</div>
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 18 }}>›</div>
      </div>

      <div className="settings-row" onClick={() => setSubPage("zaps")}>
        <div>
          <div className="settings-row-label">Zaps</div>
          <div className="settings-row-sub">Default {zapSettings.amount} sats</div>
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 18 }}>›</div>
      </div>

      <div className="settings-row" onClick={() => setSubPage("appearance")}>
        <div>
          <div className="settings-row-label">Appearance</div>
          <div className="settings-row-sub">{dark ? "Dark" : "Light"} theme, {textSize} text</div>
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 18 }}>›</div>
      </div>

      <div className="settings-row" onClick={() => setSubPage("relays")}>
        <div>
          <div className="settings-row-label">Relays</div>
          <div className="settings-row-sub">Manage read and write relays</div>
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 18 }}>›</div>
      </div>

      <div className="settings-row" onClick={() => setSubPage("customEmoji")}>
        <div>
          <div className="settings-row-label">Custom Emoji</div>
          <div className="settings-row-sub">
            {totalEmojiCount > 0 ? `${totalEmojiCount} emoji` : "Manage your personal emoji library"}
          </div>
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 18 }}>›</div>
      </div>

      <div className="settings-section-title" style={{ marginTop: 16 }}>Account</div>
      <div className="settings-row" onClick={onLogout}>
        <div className="settings-row-label" style={{ color: "#E05C8A" }}>Sign out</div>
      </div>

      <div style={{ position: "sticky", bottom: 0, padding: "12px 16px", fontSize: 11, color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif", background: "var(--bg)" }}>
        {__APP_VERSION__}
      </div>
    </div>
  );
}
