import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { uploadToBlossom } from "../utils/blossom.js";
import Overlay from "./Overlay.jsx";

const NOSTR_BUILD_URL = "https://nostr.build/api/v2/upload/files";

async function uploadBadgeImage(file, blossomServers, myPubkey) {
  if (blossomServers?.length && myPubkey) {
    const url = await uploadToBlossom(file, blossomServers, myPubkey);
    if (url) return { url, thumb: null }; // Blossom (BUD-02) doesn't return thumbnails
  }

  // Fall back to nostr.build — NIP-94 response includes a thumb tag when available
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
      tags: [["u", NOSTR_BUILD_URL], ["method", "POST"], ["payload", payloadHash]],
      content: "",
    });
    authHeader = `Nostr ${btoa(JSON.stringify(authEvent))}`;
  }
  const form = new FormData();
  form.append("file", file);
  const headers = authHeader ? { Authorization: authHeader } : {};
  const res = await fetch(NOSTR_BUILD_URL, { method: "POST", headers, body: form });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const json  = await res.json();
  const tags  = json?.nip94_event?.tags ?? [];
  const url   = tags.find(t => t[0] === "url")?.[1] ?? json?.data?.[0]?.url;
  const thumb = tags.find(t => t[0] === "thumb")?.[1] ?? null;
  if (!url) throw new Error("No URL in upload response");
  return { url, thumb };
}

export default function CreateBadgeSheet({ publishEvent, onCreated, onDismiss, blossomServers = [], myPubkey }) {
  const [name,      setName]      = useState("");
  const [desc,      setDesc]      = useState("");
  const [image,     setImage]     = useState("");
  const [thumb,     setThumb]     = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState(null);
  const fileRef = useRef(null);

  const handleFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const { url, thumb: t } = await uploadBadgeImage(file, blossomServers, myPubkey);
      setImage(url);
      setThumb(t ?? url);
    } catch (err) {
      setUploadErr(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // When URL is typed/pasted manually, keep thumb in sync (no separate thumb from upload)
  const handleImageUrlChange = val => {
    setImage(val);
    setThumb(val);
  };

  const buildTags = () => {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
                 + "-" + String(Math.floor(Date.now() / 1000));
    const tags = [["d", slug]];
    if (name.trim()) tags.push(["name", name.trim()]);
    if (desc.trim()) tags.push(["description", desc.trim()]);
    if (image.trim()) {
      tags.push(["image", image.trim(), "1024x1024"]);
      tags.push(["thumb", (thumb.trim() || image.trim()), "256x256"]);
    }
    return tags;
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    if (busy || uploading) return;
    setBusy(true);
    setError(null);
    const ev = await publishEvent({ kind: 30009, content: desc.trim(), tags: buildTags() });
    setBusy(false);
    if (!ev) { setError("Failed to publish. Check your Nostr extension and try again."); return; }
    onCreated?.(ev);
    onDismiss?.();
  };

  return createPortal(
    <Overlay onDismiss={onDismiss} compose>
      <div style={{ width: "100%", maxWidth: 700, background: "var(--bg)", borderRadius: "20px 20px 0 0", paddingTop: 8, maxHeight: "90vh", display: "flex", flexDirection: "column", animation: "slideUp .22s cubic-bezier(.4,0,.2,1)" }} onClick={e => e.stopPropagation()}>
        <div className="action-sheet-handle" />
        <div className="highlight-sheet-title">New Badge</div>

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>

          {/* Image upload area — full content width, square */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => !uploading && fileRef.current?.click()}
            onKeyDown={e => (e.key === "Enter" || e.key === " ") && !uploading && fileRef.current?.click()}
            style={{
              width: "calc(100% - 32px)",
              aspectRatio: "1/1",
              margin: "0 16px 10px",
              borderRadius: 8,
              border: "2px dashed var(--border)",
              background: "var(--surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: uploading ? "default" : "pointer",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {image.trim() ? (
              <img
                src={image}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-faint)", userSelect: "none" }}>
                <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ marginBottom: 6 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <div style={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                  Click to upload image
                </div>
              </div>
            )}
            {uploading && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
                Uploading…
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />

          {/* URL input — pre-filled after upload, supports manual paste too */}
          <input
            className="highlight-sheet-comment"
            style={{ padding: "8px 10px" }}
            placeholder="Or paste image URL"
            value={image}
            onChange={e => handleImageUrlChange(e.target.value)}
          />

          {uploadErr && <div className="highlight-sheet-error">{uploadErr}</div>}

          <input
            className="highlight-sheet-comment"
            style={{ padding: "8px 10px" }}
            placeholder="Name *"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={200}
          />
          <textarea
            className="highlight-sheet-comment"
            placeholder="Description"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            rows={3}
          />

          {error && <div className="highlight-sheet-error">{error}</div>}
        </div>

        <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
          <button
            type="button"
            className="action-sheet-btn highlight-sheet-submit"
            style={{ width: "100%", background: "var(--primary)", color: "#fff", borderRadius: 10 }}
            onClick={handleSubmit}
            disabled={busy || uploading}
          >
            {busy ? "Publishing…" : "Create Badge"}
          </button>
        </div>
        <button type="button" className="action-sheet-cancel" onClick={onDismiss}>Cancel</button>
      </div>
    </Overlay>,
    document.body
  );
}
