import { uploadToBlossom } from "./blossom.js";
import { videoPosterUrl } from "../utils.js";

/**
 * Uploads a file via Blossom (if servers given), falling back to nostr.build,
 * and returns the URL plus whatever poster/thumbnail metadata the host makes
 * available (nostr.build's NIP-94 response carries `thumb`/`image` tags for
 * videos; Blossom hosts don't, so we derive a poster URL via the deterministic
 * `?poster` convention instead).
 */
export async function uploadFileWithMeta(file, { blossomServers = [], myPubkey } = {}) {
  const isVideo = (file.type || "").startsWith("video/");

  // Try Blossom servers first
  if (blossomServers.length > 0) {
    const blossomUrl = await uploadToBlossom(file, blossomServers, myPubkey);
    if (blossomUrl) {
      return { url: blossomUrl, thumb: isVideo ? videoPosterUrl(blossomUrl) : null, mimeType: file.type || null };
    }
  }

  // Fall back to nostr.build
  const uploadUrl = "https://nostr.build/api/v2/upload/files";
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
      tags: [["u", uploadUrl], ["method", "POST"], ["payload", payloadHash]],
      content: "",
    });
    authHeader = `Nostr ${btoa(JSON.stringify(authEvent))}`;
  }
  const form = new FormData();
  form.append("file", file);
  const headers = authHeader ? { Authorization: authHeader } : {};
  const res  = await fetch(uploadUrl, { method: "POST", headers, body: form });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  const json      = await res.json();
  const nip94Tags = json?.nip94_event?.tags;
  const url       = nip94Tags?.find(t => t[0] === "url")?.[1] ?? json?.data?.[0]?.url;
  if (!url) throw new Error("No URL returned");
  const thumb = nip94Tags?.find(t => t[0] === "thumb")?.[1] ?? (isVideo ? videoPosterUrl(url) : null);
  return {
    url,
    thumb,
    image:    nip94Tags?.find(t => t[0] === "image")?.[1] ?? thumb,
    mimeType: nip94Tags?.find(t => t[0] === "m")?.[1] ?? file.type ?? null,
    sha256:   nip94Tags?.find(t => t[0] === "x")?.[1] ?? null,
    dim:      nip94Tags?.find(t => t[0] === "dim")?.[1] ?? null,
  };
}

export async function uploadFile(file, opts) {
  const { url } = await uploadFileWithMeta(file, opts);
  return url;
}
