async function sha256Hex(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function normalizeServerUrl(url) {
  return url.replace(/\/+$/, "");
}

export async function uploadToBlossom(file, servers, myPubkey) {
  if (!servers?.length || !myPubkey || !window.nostr?.signEvent) return null;

  const hash = await sha256Hex(file);
  const now  = Math.floor(Date.now() / 1000);

  for (const server of servers) {
    try {
      const authTemplate = {
        kind: 24242,
        created_at: now,
        content: "Upload file",
        tags: [
          ["t", "upload"],
          ["x", hash],
          ["expiration", String(now + 300)],
        ],
      };
      const signed  = await window.nostr.signEvent(authTemplate);
      const token   = toBase64Url(JSON.stringify(signed));
      const baseUrl = normalizeServerUrl(server);

      const res = await fetch(`${baseUrl}/upload`, {
        method: "PUT",
        headers: {
          "Authorization": `Nostr ${token}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (res.ok) {
        const json = await res.json();
        const url  = json.url;
        if (url) return url;
      }
    } catch {
      // try next server
    }
  }

  return null;
}
