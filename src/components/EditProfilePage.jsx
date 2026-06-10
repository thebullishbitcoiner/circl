import { useState, useRef } from "react";
import { uploadToBlossom } from "../utils/blossom.js";

const UPLOAD_URL = "https://nostr.build/api/v2/upload/files";

async function uploadToNostrBuild(file, myPubkey) {
  let authHeader = "";
  if (myPubkey && window.nostr?.signEvent) {
    const buf         = await file.arrayBuffer();
    const digest      = await crypto.subtle.digest("SHA-256", buf);
    const payloadHash = Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    const authEvent = await window.nostr.signEvent({
      kind: 27235,
      pubkey: myPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["u", UPLOAD_URL], ["method", "POST"], ["payload", payloadHash]],
      content: "",
    });
    authHeader = `Nostr ${btoa(JSON.stringify(authEvent))}`;
  }
  const form = new FormData();
  form.append("file", file);
  const headers = authHeader ? { Authorization: authHeader } : {};
  const res = await fetch(UPLOAD_URL, { method: "POST", headers, body: form });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${errText}`);
  }
  const json = await res.json();
  const url  = json?.nip94_event?.tags?.find(t => t[0] === "url")?.[1]
            ?? json?.data?.[0]?.url;
  if (!url) throw new Error("No URL in upload response");
  return url;
}

const LABEL_STYLE = {
  display: "block",
  fontFamily: "'DM Sans',sans-serif",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-faint)",
  textTransform: "uppercase",
  letterSpacing: ".5px",
  marginBottom: 6,
};

const FIELD_STYLE = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--surface)",
  border: "1.5px solid var(--border)",
  borderRadius: 10,
  color: "var(--text)",
  fontFamily: "'DM Sans',sans-serif",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color .15s",
};

function Field({ label, value, onChange, placeholder, multiline, hint }) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={LABEL_STYLE}>{label}</label>
      <Tag
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={multiline ? 4 : undefined}
        style={{
          ...FIELD_STYLE,
          resize: multiline ? "vertical" : undefined,
          minHeight: multiline ? 90 : undefined,
          lineHeight: multiline ? 1.5 : undefined,
        }}
        onFocus={e => { e.target.style.borderColor = "var(--primary)"; }}
        onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
      />
      {hint && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

// Small pencil/camera icon overlay button
function EditOverlay({ onClick, uploading, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={uploading}
      aria-label="Change image"
      style={{
        position: "absolute",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: uploading ? "rgba(0,0,0,.45)" : "rgba(0,0,0,.35)",
        backdropFilter: "blur(6px)",
        border: "1.5px solid rgba(255,255,255,.25)",
        borderRadius: "50%",
        width: 32, height: 32,
        cursor: uploading ? "default" : "pointer",
        color: "white",
        transition: "background .15s",
        ...style,
      }}
    >
      {uploading
        ? <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        )
      }
    </button>
  );
}

export default function EditProfilePage({ myProfile, myPubkey, publishEvent, onBack, onSaved, blossomServers = [] }) {
  const p = myProfile ?? {};

  const [displayName,  setDisplayName]  = useState(p.display_name ?? "");
  const [username,     setUsername]     = useState(p.name ?? "");
  const [picture,      setPicture]      = useState(p.picture ?? "");
  const [banner,       setBanner]       = useState(p.banner ?? "");
  const [about,        setAbout]        = useState(p.about ?? "");
  const [website,      setWebsite]      = useState(p.website ?? "");
  const [nip05,        setNip05]        = useState(p.nip05 ?? "");
  const [lud16,        setLud16]        = useState(p.lud16 ?? "");
  const [clinkNoffer,  setClinkNoffer]  = useState(p.clink_noffer ?? "");

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadError,     setUploadError]     = useState("");
  const [saving,          setSaving]          = useState(false);
  const [saveError,       setSaveError]       = useState("");

  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const uploadFile = async file => {
    if (blossomServers.length > 0) {
      const url = await uploadToBlossom(file, blossomServers, myPubkey);
      if (url) return url;
    }
    return uploadToNostrBuild(file, myPubkey);
  };

  const handleAvatarFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true); setUploadError("");
    try {
      const url = await uploadFile(file);
      setPicture(url);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleBannerFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true); setUploadError("");
    try {
      const url = await uploadFile(file);
      setBanner(url);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadingBanner(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true); setSaveError("");
    try {
      const meta = {
        ...(p._raw ?? {}),
        name: username.trim() || undefined,
        display_name: displayName.trim() || undefined,
        picture: picture.trim() || undefined,
        banner: banner.trim() || undefined,
        about: about.trim() || undefined,
        website: website.trim() || undefined,
        nip05: nip05.trim() || undefined,
        lud16: lud16.trim() || undefined,
        clink_noffer: clinkNoffer.trim() || undefined,
      };
      const clean = Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined));
      const result = await publishEvent({ kind: 0, content: JSON.stringify(clean), tags: [] });
      if (!result) throw new Error("Publish returned null");
      onSaved?.();
      onBack();
    } catch (e) {
      setSaveError(e?.message || "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const name = displayName || username || "";

  return (
    <div className="slide-panel-scroll" style={{ height: "100%", overflowY: "auto" }}>

      {/* Hidden file inputs */}
      <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarFile} />
      <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerFile} />

      {/* Banner */}
      <div
        className="profile-banner"
        style={{ position: "relative", cursor: "pointer" }}
        onClick={() => !uploadingBanner && bannerInputRef.current?.click()}
      >
        {banner ? (
          <>
            <img className="profile-banner-image" src={banner} alt="" onError={e => { e.target.style.display = "none"; }} />
            <div className="profile-banner-overlay" />
          </>
        ) : (
          <div className="profile-banner-glyph">◎</div>
        )}

        {/* Back button */}
        <button
          className="back-btn"
          onClick={e => { e.stopPropagation(); onBack(); }}
          style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,.25)", backdropFilter: "blur(8px)", color: "white", animation: "fadeIn .35s ease both" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Banner edit button */}
        <EditOverlay
          uploading={uploadingBanner}
          onClick={e => { e.stopPropagation(); bannerInputRef.current?.click(); }}
          style={{ top: 12, right: 12, animation: "fadeIn .35s ease both" }}
        />
      </div>

      {/* Avatar + Save header row */}
      <div className="profile-identity" style={{ paddingBottom: 8 }}>
        <div className="profile-av-wrap">
          {/* Avatar with edit overlay */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <div
              className="profile-av"
              style={{ cursor: "pointer" }}
              onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
            >
              {picture
                ? <img src={picture} alt={name} onError={e => { e.target.style.display = "none"; }} />
                : name[0]?.toUpperCase()}
            </div>
            <EditOverlay
              uploading={uploadingAvatar}
              onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
              style={{ bottom: -4, right: -4, width: 26, height: 26, animation: "fadeIn .35s ease both" }}
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "7px 20px",
              background: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: 50,
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? "default" : "pointer",
              opacity: saving ? .6 : 1,
              animation: "fadeIn .35s ease both",
              transition: "opacity .15s",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Upload error */}
      {uploadError && (
        <div style={{ margin: "0 20px 16px", padding: "9px 13px", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 10, color: "#ef4444", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
          {uploadError}
        </div>
      )}

      {/* Form fields */}
      <div style={{ padding: "4px 20px 32px", animation: "fadeUp .35s .05s ease both" }}>
        <Field label="Display name"      value={displayName}  onChange={setDisplayName}  placeholder="Your name" />
        <Field label="Username"          value={username}     onChange={setUsername}     placeholder="yourhandle" hint="Short handle, no spaces (name field)" />
        <Field label="Profile picture"   value={picture}      onChange={setPicture}      placeholder="https://…" hint="URL or upload via the avatar above" />
        <Field label="Banner image"      value={banner}       onChange={setBanner}       placeholder="https://…" hint="URL or upload via the banner above" />
        <Field label="Bio"               value={about}        onChange={setAbout}        placeholder="Tell the world about yourself" multiline />
        <Field label="Website"           value={website}      onChange={setWebsite}      placeholder="https://yoursite.com" />
        <Field label="NIP-05 identifier" value={nip05}        onChange={setNip05}        placeholder="you@domain.com" hint="Verified Nostr address" />
        <Field label="Lightning address" value={lud16}        onChange={setLud16}        placeholder="you@wallet.com" hint="For receiving zaps" />
        <Field label="Noffer (CLINK)"    value={clinkNoffer}  onChange={setClinkNoffer}  placeholder="noffer1…" hint="CLINK static Lightning offer" />

        {saveError && (
          <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 10, color: "#ef4444", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
            {saveError}
          </div>
        )}
      </div>
    </div>
  );
}
