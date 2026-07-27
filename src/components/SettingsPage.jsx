import { useState } from "react";
import { createPortal } from "react-dom";
import useMailboxes from "../hooks/useMailboxes.js";
import useSearchRelays from "../hooks/useSearchRelays.js";
import useBlockedRelays from "../hooks/useBlockedRelays.js";
import usePrivateRelays from "../hooks/usePrivateRelays.js";
import { MailboxesFactory } from "applesauce-core";
import CustomEmojiSettingsPage from "./CustomEmojiSettingsPage.jsx";
import useContentSettings from "../hooks/useContentSettings.js";
import ZapModal from "./ZapModal.jsx";
import { displayName } from "../utils.js";
import { DEV_LUD16, DEV_PUBKEY } from "../constants.js";

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

// ── Relay shared helpers ──────────────────────────────────────────────────────

function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)} onBlur={() => setShow(false)}
        aria-label="More info"
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "calc(var(--font-base) - 1px)", lineHeight: 1, padding: "1px 3px", display: "flex", alignItems: "center" }}
      >ⓘ</button>
      {show && (
        <span style={{
          position: "absolute", left: 0, top: "calc(100% + 5px)", zIndex: 20,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
          padding: "6px 10px", fontSize: "calc(var(--font-base) - 3px)", color: "var(--text-muted)",
          fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5, width: 260, whiteSpace: "normal",
          boxShadow: "0 4px 12px rgba(0,0,0,.18)", pointerEvents: "none",
        }}>{text}</span>
      )}
    </span>
  );
}

function RelaySectionHeader({ label, info }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "14px 16px 6px" }}>
      <span style={{ fontSize: "calc(var(--font-base) - 2px)", fontWeight: 700, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      {info && <InfoTooltip text={info} />}
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

const _fmtRelayUrl = url => url.replace(/^wss?:\/\//, "").replace(/\/$/, "");

function RelayEditor({ pubkey, signAndPublish }) {
  const { inboxes, outboxes } = useMailboxes(pubkey);
  const [localInboxes, setLocalInboxes] = useState(null);
  const [localOutboxes, setLocalOutboxes] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [addRead, setAddRead] = useState(true);
  const [addWrite, setAddWrite] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const effectiveInboxes = localInboxes ?? inboxes;
  const effectiveOutboxes = localOutboxes ?? outboxes;
  const allRelays = [...new Set([...effectiveInboxes, ...effectiveOutboxes])];

  async function save() {
    if (!signAndPublish) return;
    setSaving(true);
    try {
      const template = await MailboxesFactory.create({ inboxes: effectiveInboxes, outboxes: effectiveOutboxes });
      await signAndPublish(template);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  function toggleRead(url, checked) {
    const next = checked ? [...effectiveInboxes, url] : effectiveInboxes.filter(r => r !== url);
    setLocalInboxes(next);
    setDirty(true);
  }

  function toggleWrite(url, checked) {
    const next = checked ? [...effectiveOutboxes, url] : effectiveOutboxes.filter(r => r !== url);
    setLocalOutboxes(next);
    setDirty(true);
  }

  function remove(url) {
    const nextIn = effectiveInboxes.filter(r => r !== url);
    const nextOut = effectiveOutboxes.filter(r => r !== url);
    setLocalInboxes(nextIn);
    setLocalOutboxes(nextOut);
    setDirty(true);
  }

  function add() {
    const url = normalizeRelayUrl(urlInput);
    if (!url || (!addRead && !addWrite)) return;
    const nextIn = addRead && !effectiveInboxes.includes(url) ? [...effectiveInboxes, url] : effectiveInboxes;
    const nextOut = addWrite && !effectiveOutboxes.includes(url) ? [...effectiveOutboxes, url] : effectiveOutboxes;
    if (nextIn === effectiveInboxes && nextOut === effectiveOutboxes) return;
    setLocalInboxes(nextIn);
    setLocalOutboxes(nextOut);
    setUrlInput("");
    setDirty(true);
  }

  const colW = 44;
  const removeW = 26;
  const inputH = "calc(var(--font-base) + 20px)";
  const colHead = { width: colW, textAlign: "center", fontSize: "calc(var(--font-base) - 3px)", fontWeight: 700, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 };
  const cbCell = { width: colW, display: "flex", justifyContent: "center", flexShrink: 0 };
  const cbStyle = { cursor: saving ? "default" : "pointer", width: 15, height: 15 };

  return (
    <div style={{ padding: "16px" }}>
      {allRelays.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 5, marginBottom: 2, borderBottom: "1px solid var(--border)" }}>
          <span style={{ flex: 1 }} />
          <span style={colHead}>Read</span>
          <span style={colHead}>Write</span>
          <span style={{ width: removeW, flexShrink: 0 }} />
        </div>
      )}
      {allRelays.length === 0 && (
        <div style={{ fontSize: "calc(var(--font-base) - 2px)", color: "var(--text-faint)", fontFamily: "monospace", padding: "6px 0" }}>None configured</div>
      )}
      {allRelays.map((r, i) => (
        <div key={r} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: i < allRelays.length - 1 ? "1px solid var(--border)" : "none" }}>
          <span style={{ fontFamily: "monospace", fontSize: "calc(var(--font-base) - 2px)", color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {_fmtRelayUrl(r)}
          </span>
          <div style={cbCell}>
            <input type="checkbox" checked={effectiveInboxes.includes(r)} onChange={e => toggleRead(r, e.target.checked)} disabled={saving} style={cbStyle} />
          </div>
          <div style={cbCell}>
            <input type="checkbox" checked={effectiveOutboxes.includes(r)} onChange={e => toggleWrite(r, e.target.checked)} disabled={saving} style={cbStyle} />
          </div>
          <button onClick={() => remove(r)} disabled={saving}
            style={{ width: removeW, padding: 0, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-faint)", fontSize: "calc(var(--font-base) + 2px)", fontFamily: "'DM Sans',sans-serif", cursor: saving ? "default" : "pointer", lineHeight: 1, flexShrink: 0, opacity: saving ? 0.5 : 1, height: "calc(var(--font-base) + 14px)" }}>×</button>
        </div>
      ))}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
        <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === "Enter" && add()}
          placeholder="relay.example.com" disabled={saving}
          style={{ flex: 1, padding: "0 10px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "monospace", fontSize: "calc(var(--font-base) - 2px)", outline: "none", opacity: saving ? 0.5 : 1, height: inputH, boxSizing: "border-box", minWidth: 0 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "calc(var(--font-base) - 2px)", color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", cursor: "pointer", userSelect: "none", flexShrink: 0 }}>
          <input type="checkbox" checked={addRead} onChange={e => setAddRead(e.target.checked)} style={{ cursor: "pointer", width: 14, height: 14 }} />
          Read
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "calc(var(--font-base) - 2px)", color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", cursor: "pointer", userSelect: "none", flexShrink: 0 }}>
          <input type="checkbox" checked={addWrite} onChange={e => setAddWrite(e.target.checked)} style={{ cursor: "pointer", width: 14, height: 14 }} />
          Write
        </label>
        <button onClick={add} disabled={saving || (!addRead && !addWrite)}
          style={{ padding: "0 14px", borderRadius: 8, border: "none", background: "var(--primary)", color: "white", fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", fontWeight: 600, cursor: (saving || (!addRead && !addWrite)) ? "default" : "pointer", opacity: (saving || (!addRead && !addWrite)) ? 0.6 : 1, flexShrink: 0, height: inputH }}>Add</button>
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
        <button onClick={save} disabled={saving || !dirty}
          style={{ padding: "0 18px", borderRadius: 8, border: "none", background: "var(--primary)", color: "white", fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", fontWeight: 600, cursor: (saving || !dirty) ? "default" : "pointer", opacity: (saving || !dirty) ? 0.5 : 1, height: inputH }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Relay list editor (NIP-51 kind 10007 search / 10006 blocked / 10013 private) ──
// Shared by SearchRelayEditor, BlockedRelayEditor and PrivateRelayEditor: entries
// marked "Private" round-trip as a NIP-44 encrypted content blob, while plain
// entries stay as public "relay" tags — any pre-existing plaintext entries are
// preserved as-is and only newly-added entries default to encrypted.

function hasNip44ForRelayList() {
  return typeof window !== "undefined" &&
    typeof window.nostr?.nip44?.encrypt === "function";
}

function RelayListEditor({ pubkey, signAndPublish, kind, relays, placeholder }) {
  const [localRelays, setLocalRelays]   = useState(null); // null = use loaded
  const [urlInput, setUrlInput]         = useState("");
  const [saving, setSaving]             = useState(false);
  const [dirty, setDirty]               = useState(false);
  const [newVisibility, setNewVisibility] = useState("private"); // "private" | "public"

  const effective = localRelays ?? relays;

  async function save() {
    if (!signAndPublish) return;
    setSaving(true);
    try {
      const publicUrls    = effective.filter(r => r.source === "public").map(r => r.url);
      const privateUrls   = effective.filter(r => r.source === "encrypted").map(r => r.url);
      const tags          = publicUrls.map(url => ["relay", url]);
      let content         = "";
      if (privateUrls.length > 0) {
        if (!hasNip44ForRelayList()) throw new Error("Your signer does not support NIP-44 encryption");
        content = await window.nostr.nip44.encrypt(
          pubkey,
          JSON.stringify(privateUrls.map(url => ["relay", url]))
        );
      }
      await signAndPublish({ kind, tags, content });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  function toggleSource(url) {
    const next = effective.map(r =>
      r.url === url ? { ...r, source: r.source === "encrypted" ? "public" : "encrypted" } : r
    );
    setLocalRelays(next);
    setDirty(true);
  }

  function remove(url) {
    const next = effective.filter(r => r.url !== url);
    setLocalRelays(next);
    setDirty(true);
  }

  function add() {
    const url = normalizeRelayUrl(urlInput);
    if (!url || effective.some(r => r.url === url)) return;
    const source = newVisibility === "private" ? "encrypted" : "public";
    const next = [...effective, { url, source }];
    setLocalRelays(next);
    setUrlInput("");
    setDirty(true);
  }

  const inputH = "calc(var(--font-base) + 20px)";

  return (
    <div style={{ padding: "16px" }}>
      {effective.length === 0 && (
        <div style={{ fontSize: "calc(var(--font-base) - 2px)", color: "var(--text-faint)", fontFamily: "monospace", padding: "6px 0" }}>None configured</div>
      )}
      {effective.map((r, i) => (
        <div key={r.url} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: i < effective.length - 1 ? "1px solid var(--border)" : "none" }}>
          <span style={{ fontFamily: "monospace", fontSize: "calc(var(--font-base) - 2px)", color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {_fmtRelayUrl(r.url)}
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: saving ? "default" : "pointer", flexShrink: 0, opacity: saving ? 0.5 : 1 }}>
            <input type="checkbox" checked={r.source === "encrypted"} disabled={saving}
              onChange={() => toggleSource(r.url)}
              style={{ cursor: saving ? "default" : "pointer" }} />
            <span style={{ fontSize: "calc(var(--font-base) - 2px)", color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif" }}>Private</span>
          </label>
          <button onClick={() => remove(r.url)} disabled={saving}
            style={{ width: 26, padding: 0, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-faint)", fontSize: "calc(var(--font-base) + 2px)", fontFamily: "'DM Sans',sans-serif", cursor: saving ? "default" : "pointer", lineHeight: 1, flexShrink: 0, opacity: saving ? 0.5 : 1, height: "calc(var(--font-base) + 14px)" }}>×</button>
        </div>
      ))}

      <div style={{ marginTop: effective.length > 0 ? 14 : 8, display: "flex", alignItems: "center", gap: 8 }}>
        <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === "Enter" && add()}
          placeholder={placeholder} disabled={saving}
          style={{ flex: 1, padding: "0 10px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "monospace", fontSize: "calc(var(--font-base) - 2px)", outline: "none", opacity: saving ? 0.5 : 1, height: inputH, boxSizing: "border-box" }} />
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", flexShrink: 0 }}>
          <input type="checkbox" checked={newVisibility === "private"} onChange={e => setNewVisibility(e.target.checked ? "private" : "public")} style={{ cursor: "pointer" }} />
          <span style={{ fontSize: "calc(var(--font-base) - 2px)", color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap" }}>Private</span>
        </label>
        <button onClick={add} disabled={saving || !urlInput.trim()}
          style={{ padding: "0 18px", borderRadius: 8, border: "none", background: "var(--primary)", color: "white", fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", fontWeight: 600, cursor: (saving || !urlInput.trim()) ? "default" : "pointer", opacity: (saving || !urlInput.trim()) ? 0.6 : 1, flexShrink: 0, height: inputH }}>Add</button>
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
        <button onClick={save} disabled={saving || !dirty}
          style={{ padding: "0 18px", borderRadius: 8, border: "none", background: "var(--primary)", color: "white", fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", fontWeight: 600, cursor: (saving || !dirty) ? "default" : "pointer", opacity: (saving || !dirty) ? 0.5 : 1, height: inputH }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function SearchRelayEditor({ pubkey, signAndPublish }) {
  const relays = useSearchRelays(pubkey); // [{url, source}]
  return <RelayListEditor pubkey={pubkey} signAndPublish={signAndPublish} kind={10007} relays={relays} placeholder="search.relay.example.com" />;
}

function BlockedRelayEditor({ pubkey, signAndPublish }) {
  const relays = useBlockedRelays(pubkey); // [{url, source}]
  return <RelayListEditor pubkey={pubkey} signAndPublish={signAndPublish} kind={10006} relays={relays} placeholder="relay.example.com" />;
}

function PrivateRelayEditor({ pubkey, signAndPublish }) {
  const relays = usePrivateRelays(pubkey); // [{url, source}]
  return <RelayListEditor pubkey={pubkey} signAndPublish={signAndPublish} kind={10013} relays={relays} placeholder="relay.example.com" />;
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
  const [presets,   setPresets]   = useState((zapSettings.presets ?? [21, 100, 500, 1000, 5000, 21000]).map(String));

  const inputStyle = {
    padding: "6px 10px", borderRadius: 8,
    border: "1.5px solid var(--border)", background: "var(--bg)",
    color: "var(--text)", fontFamily: "'DM Sans',sans-serif",
    fontSize: 13, outline: "none",
  };

  const saveAll = ({ amount = zapAmount, msg = zapMsg, ps = presets } = {}) => {
    const parsedAmount  = Math.max(1, parseInt(amount) || 21);
    const parsedPresets = ps.map(v => Math.max(1, parseInt(v) || 1));
    onSaveZapSettings?.({ amount: parsedAmount, msg, presets: parsedPresets });
  };

  const handleAmountChange = e => { setZapAmount(e.target.value); const p = parseInt(e.target.value); if (p >= 1) saveAll({ amount: e.target.value }); };
  const handleAmountBlur   = () => { const v = String(Math.max(1, parseInt(zapAmount) || 21)); setZapAmount(v); saveAll({ amount: v }); };
  const handleMsgChange    = e => { setZapMsg(e.target.value); saveAll({ msg: e.target.value }); };

  const handlePresetChange = (i, val) => {
    const next = presets.map((p, idx) => idx === i ? val : p);
    setPresets(next);
    const p = parseInt(val);
    if (p >= 1) saveAll({ ps: next });
  };
  const handlePresetBlur = (i) => {
    const next = presets.map((p, idx) => idx === i ? String(Math.max(1, parseInt(p) || 1)) : p);
    setPresets(next);
    saveAll({ ps: next });
  };

  return (
    <SubPage title="Zaps" onBack={onBack}>
      <div style={{ margin: "12px 16px 4px", padding: "14px 16px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", fontFamily: "'DM Sans',sans-serif", marginBottom: 12 }}>Zap Defaults</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <label style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", flexShrink: 0 }}>Default amount</label>
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

      <div style={{ margin: "10px 16px 4px", padding: "14px 16px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", fontFamily: "'DM Sans',sans-serif", marginBottom: 12 }}>Preset Amounts</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {presets.map((val, i) => (
            <input key={i} type="number" min="1" value={val}
              onChange={e => handlePresetChange(i, e.target.value)}
              onBlur={() => handlePresetBlur(i)}
              style={{ ...inputStyle, textAlign: "right", fontFamily: "monospace", width: "100%", boxSizing: "border-box" }}
            />
          ))}
        </div>
      </div>
    </SubPage>
  );
}

function ContentSubPage({ onBack }) {
  const { autoplayVideos, setAutoplayVideos, loopVideos, setLoopVideos } = useContentSettings();

  return (
    <SubPage title="Content" onBack={onBack}>
      <div className="settings-row" onClick={() => setAutoplayVideos(!autoplayVideos)}>
        <div>
          <div className="settings-row-label">Autoplay videos</div>
          <div className="settings-row-sub">Play videos automatically in the feed (muted)</div>
        </div>
        <label className="toggle" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={autoplayVideos} onChange={() => setAutoplayVideos(!autoplayVideos)} />
          <div className="toggle-track" />
          <div className="toggle-thumb" />
        </label>
      </div>
      <div className="settings-row" onClick={() => setLoopVideos(!loopVideos)}>
        <div>
          <div className="settings-row-label">Loop videos</div>
          <div className="settings-row-sub">Replay videos automatically when they end</div>
        </div>
        <label className="toggle" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={loopVideos} onChange={() => setLoopVideos(!loopVideos)} />
          <div className="toggle-track" />
          <div className="toggle-thumb" />
        </label>
      </div>
    </SubPage>
  );
}

function AppearanceSubPage({ onBack, dark, toggleDark, textSize, onTextSizeChange }) {
  const { bigFontShortNotes, setBigFontShortNotes } = useContentSettings();

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
      <div className="settings-row" onClick={() => setBigFontShortNotes(!bigFontShortNotes)}>
        <div>
          <div className="settings-row-label">Use BIG font for short notes</div>
          <div className="settings-row-sub">Render notes under 50 characters in an excessively large font</div>
        </div>
        <label className="toggle" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={bigFontShortNotes} onChange={() => setBigFontShortNotes(!bigFontShortNotes)} />
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
  const { relayAuth, setRelayAuth } = useContentSettings();
  return (
    <SubPage title="Relays" onBack={onBack}>
      <RelaySectionHeader label="Authentication" info="Your configured relays (mailbox + private) always authenticate automatically — they already know your pubkey, so there's no privacy cost. Enabling this for unknown relays links your pubkey and IP to relays added from event hints. The trade-off: keeping it off protects your privacy but may cause some events to fail to load if the relay requires auth to serve content." />
      <div style={{ margin: "0 12px 20px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
        <div className="settings-row" onClick={() => setRelayAuth(!relayAuth)}>
          <div>
            <div className="settings-row-label">Authenticate with unknown relays</div>
            <div className="settings-row-sub">Sign NIP-42 AUTH challenges from relays not in your configured list</div>
          </div>
          <label className="toggle" onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={relayAuth} onChange={() => setRelayAuth(!relayAuth)} />
            <div className="toggle-track" />
            <div className="toggle-thumb" />
          </label>
        </div>
      </div>
      <RelaySectionHeader label="Mailbox Relays" info="Relays used to publish and receive notes (NIP-65)" />
      <div style={{ margin: "0 12px 20px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
        <RelayEditor pubkey={pubkey} signAndPublish={signAndPublish} />
      </div>
      <RelaySectionHeader label="Search Relays" info="Relays queried when searching notes (NIP-51 kind 10007)" />
      <div style={{ margin: "0 12px 20px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
        <SearchRelayEditor pubkey={pubkey} signAndPublish={signAndPublish} />
      </div>
      <RelaySectionHeader label="Blocked Relays" info="Relays this client will never connect to — useful for retired or slow relays (NIP-51 kind 10006)" />
      <div style={{ margin: "0 12px 20px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
        <BlockedRelayEditor pubkey={pubkey} signAndPublish={signAndPublish} />
      </div>
      <RelaySectionHeader label="Private Relays" info="Relays used to store your drafts, kept off your public relays (NIP-51 kind 10013)" />
      <div style={{ margin: "0 12px 16px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
        <PrivateRelayEditor pubkey={pubkey} signAndPublish={signAndPublish} />
      </div>
    </SubPage>
  );
}

// ── Blossom sub-page ──────────────────────────────────────────────────────────

const DEFAULT_BLOSSOM_SERVERS = [
  "https://blossom.band",
  "https://cdn.satellite.earth",
  "https://nostr.download",
];

function normalizeBlossomUrl(input) {
  const s = (input || "").trim();
  if (!s) return null;
  const withScheme = s.startsWith("https://") || s.startsWith("http://") ? s : `https://${s}`;
  try { new URL(withScheme); return withScheme.replace(/\/+$/, ""); } catch { return null; }
}

function BlossomSubPage({ onBack, servers, saveServers }) {
  const [localServers, setLocalServers] = useState(null);
  const [inputVal,     setInputVal]     = useState("");
  const [saving,       setSaving]       = useState(false);

  const effective = localServers ?? servers;

  async function persist(next) {
    setSaving(true);
    setLocalServers(next);
    try { await saveServers(next); } finally { setSaving(false); }
  }

  function add() {
    const url = normalizeBlossomUrl(inputVal);
    if (!url || effective.includes(url)) return;
    setInputVal("");
    persist([...effective, url]);
  }

  function remove(url) { persist(effective.filter(u => u !== url)); }

  function moveUp(i) {
    if (i === 0) return;
    const next = [...effective];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    persist(next);
  }

  function moveDown(i) {
    if (i === effective.length - 1) return;
    const next = [...effective];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    persist(next);
  }

  const fmtUrl = url => url.replace(/^https?:\/\//, "");

  const btnStyle = {
    padding: "0 14px", borderRadius: 8, border: "none",
    background: "var(--primary)", color: "white",
    fontFamily: "'DM Sans',sans-serif", fontSize: "calc(var(--font-base) - 2px)",
    fontWeight: 600, cursor: saving ? "default" : "pointer",
    opacity: saving ? 0.6 : 1, flexShrink: 0,
    height: "calc(var(--font-base) + 20px)",
  };

  const arrowBtn = (disabled) => ({
    padding: "2px 6px", borderRadius: 5,
    border: "1px solid var(--border)", background: "transparent",
    color: disabled ? "var(--text-faint)" : "var(--text-muted)",
    fontSize: 12, lineHeight: 1, cursor: disabled || saving ? "default" : "pointer",
    opacity: disabled || saving ? 0.35 : 1, flexShrink: 0,
  });

  return (
    <SubPage title="Blossom" onBack={onBack}>
      <div style={{ padding: "12px 16px 0" }}>
        <p style={{ margin: "0 0 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Blossom servers store your media files. The first server is the primary upload target; others are tried if it fails. Falls back to nostr.build if all servers fail.
        </p>

        {/* Server list */}
        {effective.length === 0 ? (
          <div style={{ fontSize: "calc(var(--font-base) - 2px)", color: "var(--text-faint)", fontFamily: "monospace", padding: "6px 0 10px" }}>No servers configured</div>
        ) : effective.map((url, i) => (
          <div key={url} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", borderBottom: i < effective.length - 1 ? "1px solid var(--border)" : "none" }}>
            {i === 0 && (
              <span style={{ fontSize: 9, fontWeight: 700, color: "var(--primary)", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", background: "var(--surface)", border: "1px solid var(--primary)", borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>Primary</span>
            )}
            <span style={{ fontFamily: "monospace", fontSize: "calc(var(--font-base) - 2px)", color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtUrl(url)}</span>
            <button onClick={() => moveUp(i)}   disabled={i === 0}                  style={arrowBtn(i === 0)}>↑</button>
            <button onClick={() => moveDown(i)} disabled={i === effective.length - 1} style={arrowBtn(i === effective.length - 1)}>↓</button>
            <button onClick={() => remove(url)} disabled={saving}
              style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-faint)", fontSize: "calc(var(--font-base) + 2px)", fontFamily: "'DM Sans',sans-serif", cursor: saving ? "default" : "pointer", lineHeight: 1, flexShrink: 0, opacity: saving ? 0.5 : 1 }}>×</button>
          </div>
        ))}

        {/* Add input */}
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <input
            value={inputVal} onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
            placeholder="blossom.example.com" disabled={saving}
            style={{ flex: 1, padding: "0 10px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "monospace", fontSize: "calc(var(--font-base) - 2px)", outline: "none", minWidth: 0, opacity: saving ? 0.5 : 1, height: "calc(var(--font-base) + 20px)", boxSizing: "border-box" }}
          />
          <button onClick={add} disabled={saving} style={btnStyle}>Add</button>
        </div>

        {/* Reset to defaults */}
        <button
          onClick={() => persist([...DEFAULT_BLOSSOM_SERVERS])}
          disabled={saving}
          style={{ marginTop: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", fontSize: "calc(var(--font-base) - 2px)", cursor: saving ? "default" : "pointer", opacity: saving ? 0.5 : 1 }}
        >
          Reset to defaults
        </button>

        {saving && <div style={{ fontSize: "calc(var(--font-base) - 3px)", color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", paddingTop: 8 }}>Publishing…</div>}
      </div>
    </SubPage>
  );
}

// ── Storage sub-page ─────────────────────────────────────────────────────────

const KEY_LABELS = {
  circl_profiles_v1:   "Profile cache",
  circl_lists_v1:      "Legacy list event cache (can be deleted)",
  circl_mutes:         "Mute list (decrypted)",
  circl_bookmarks:     "Bookmark list (decrypted)",
  circl_circles:       "Circles (decrypted)",
  circl_zap_req_cache: "Zap request cache",
};

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function getAppKeys() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("circl_")) continue;
      const raw = localStorage.getItem(key) ?? "";
      out.push({ key, size: raw.length });
    }
  } catch {}
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

function StorageDetailPage({ storageKey, onBack, onDeleted }) {
  const raw = localStorage.getItem(storageKey) ?? "";
  let pretty = raw;
  let summary = null;
  try {
    const parsed = JSON.parse(raw);
    pretty = JSON.stringify(parsed, null, 2);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      summary = `${Object.keys(parsed).length} entries`;
    else if (Array.isArray(parsed))
      summary = `${parsed.length} items`;
  } catch {}
  const MAX_DISPLAY = 60000;
  const display = pretty.length > MAX_DISPLAY ? pretty.slice(0, MAX_DISPLAY) + "\n\n… [truncated]" : pretty;

  function del() {
    localStorage.removeItem(storageKey);
    onDeleted();
  }

  return (
    <SubPage title={storageKey} onBack={onBack}>
      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif" }}>
            {summary ? `${summary} · ` : ""}{formatBytes(raw.length)}
          </span>
          <button onClick={del} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #E05C8A", background: "transparent", color: "#E05C8A", fontSize: 12, fontFamily: "'DM Sans',sans-serif", cursor: "pointer" }}>
            Delete
          </button>
        </div>
        <pre style={{
          fontFamily: "monospace", fontSize: 11, color: "var(--text)",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, padding: 12, margin: 0,
          overflow: "auto", maxHeight: "62vh",
          whiteSpace: "pre",
        }}>{display}</pre>
      </div>
    </SubPage>
  );
}

function StorageSubPage({ onBack }) {
  const [keys, setKeys] = useState(getAppKeys);
  const [selectedKey, setSelectedKey] = useState(null);

  if (selectedKey) {
    return (
      <StorageDetailPage
        storageKey={selectedKey}
        onBack={() => setSelectedKey(null)}
        onDeleted={() => { setSelectedKey(null); setKeys(getAppKeys()); }}
      />
    );
  }

  const totalSize = keys.reduce((s, k) => s + k.size, 0);

  return (
    <SubPage title="Storage" onBack={onBack}>
      <div style={{ padding: "12px 16px 0" }}>
        {keys.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", padding: "8px 0" }}>
            No local data stored
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", marginBottom: 10 }}>
              {keys.length} item{keys.length !== 1 ? "s" : ""} · {formatBytes(totalSize)} total
            </div>
            {keys.map(({ key, size }, i) => (
              <div
                key={key}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: i < keys.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer" }}
                onClick={() => setSelectedKey(key)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "calc(var(--font-base) - 2px)", fontFamily: "monospace", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{key}</div>
                  {KEY_LABELS[key] && (
                    <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", marginTop: 2 }}>{KEY_LABELS[key]}</div>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "'DM Sans',sans-serif", flexShrink: 0 }}>{formatBytes(size)}</span>
                <button
                  onClick={e => { e.stopPropagation(); localStorage.removeItem(key); setKeys(getAppKeys()); }}
                  style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-faint)", fontSize: "calc(var(--font-base) + 2px)", fontFamily: "'DM Sans',sans-serif", cursor: "pointer", lineHeight: 1, flexShrink: 0 }}
                >×</button>
              </div>
            ))}
          </>
        )}
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
  blossomServers = [], saveBlossomServers,
  profiles, sendZap, onZapFail,
}) {
  const [subPage, setSubPage] = useState(null);
  const [showDevZap, setShowDevZap] = useState(false);

  const devZapMsg = `Circl support from ${displayName(pubkey, profiles)}`;
  const doSendDevZap = async ({ amount, msg }) => {
    if (!sendZap) { onZapFail?.("no_wallet"); return; }
    const result = await sendZap({ amountSats: amount, recipientLnAddr: DEV_LUD16, recipientPubkey: DEV_PUBKEY, msg: msg || devZapMsg });
    if (!result.ok) onZapFail?.(result.reason);
  };

  if (subPage === "wallet") {
    return <WalletSubPage onBack={() => setSubPage(null)} pubkey={pubkey} wallet={wallet} onWalletConnected={onWalletConnected} onWalletDisconnect={onWalletDisconnect} />;
  }
  if (subPage === "zaps") {
    return <ZapsSubPage onBack={() => setSubPage(null)} zapSettings={zapSettings} onSaveZapSettings={onSaveZapSettings} />;
  }
  if (subPage === "appearance") {
    return <AppearanceSubPage onBack={() => setSubPage(null)} dark={dark} toggleDark={toggleDark} textSize={textSize} onTextSizeChange={onTextSizeChange} />;
  }
  if (subPage === "content") {
    return <ContentSubPage onBack={() => setSubPage(null)} />;
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
  if (subPage === "blossom") {
    return <BlossomSubPage onBack={() => setSubPage(null)} servers={blossomServers} saveServers={saveBlossomServers} />;
  }
  if (subPage === "storage") {
    return <StorageSubPage onBack={() => setSubPage(null)} />;
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

      <div className="settings-row" onClick={() => setSubPage("content")}>
        <div>
          <div className="settings-row-label">Content</div>
          <div className="settings-row-sub">Video autoplay and media preferences</div>
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

      <div className="settings-row" onClick={() => setSubPage("blossom")}>
        <div>
          <div className="settings-row-label">Blossom</div>
          <div className="settings-row-sub">
            {blossomServers.length > 0
              ? `${blossomServers.length} server${blossomServers.length > 1 ? "s" : ""} configured`
              : "Media server storage"}
          </div>
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 18 }}>›</div>
      </div>

      <div className="settings-row" onClick={() => setSubPage("storage")}>
        <div>
          <div className="settings-row-label">Storage</div>
          <div className="settings-row-sub">View and clear local cache</div>
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 18 }}>›</div>
      </div>

      <div className="settings-zap-dev-cta" onClick={() => setShowDevZap(true)}>
        <div className="settings-zap-dev-cta-icon">⚡</div>
        <div>
          <div className="settings-zap-dev-cta-title">Enjoying Circl?</div>
          <div className="settings-zap-dev-cta-sub">ZAP THE DEV!</div>
        </div>
      </div>

      <div className="settings-section-title" style={{ marginTop: 16 }}>Account</div>
      <div className="settings-row" onClick={onLogout}>
        <div className="settings-row-label" style={{ color: "#E05C8A" }}>Sign out</div>
      </div>

      <div style={{ position: "sticky", bottom: 0, padding: "12px 16px", fontSize: 11, color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif", background: "var(--bg)" }}>
        {__APP_VERSION__}
      </div>

      {showDevZap && createPortal(
        <ZapModal
          title="Zap the dev"
          defaultAmount={zapSettings.amount}
          defaultMsg={devZapMsg}
          onZap={doSendDevZap}
          onDismiss={() => setShowDevZap(false)}
        />,
        document.body
      )}
    </div>
  );
}
