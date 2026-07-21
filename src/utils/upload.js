import { uploadToBlossom } from "./blossom.js";

export async function uploadFile(file, { blossomServers = [], myPubkey } = {}) {
  // Try Blossom servers first
  if (blossomServers.length > 0) {
    const blossomUrl = await uploadToBlossom(file, blossomServers, myPubkey);
    if (blossomUrl) return blossomUrl;
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
  const json = await res.json();
  const url  = json?.nip94_event?.tags?.find(t => t[0] === "url")?.[1]
            ?? json?.data?.[0]?.url;
  if (!url) throw new Error("No URL returned");
  return url;
}
