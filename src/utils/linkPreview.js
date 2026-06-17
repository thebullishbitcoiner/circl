const WORKER_URL = import.meta.env.VITE_LINK_PREVIEW_WORKER ?? "";

// Module-scope: deduplicates concurrent requests and survives re-renders
const _cache = new Map(); // url → Promise<{title, description, image, siteName} | null>

export function fetchLinkPreview(url) {
  if (!WORKER_URL) return Promise.resolve(null);
  if (_cache.has(url)) return _cache.get(url);
  const p = fetch(`${WORKER_URL}?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(8000),
  })
    .then(r => (r.ok ? r.json() : null))
    .then(d => (d?.title ? d : null))
    .catch(() => null);
  _cache.set(url, p);
  return p;
}
