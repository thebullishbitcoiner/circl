import { GIPHY_KEY } from "../constants.js";

// nostr.build GIF API (https://gifs.nostr.build/llms.txt). Browser clients are
// identified by Origin only — never send custom headers or Authorization, the
// CORS preflight would fail. An unregistered origin gets a 403 with no CORS
// headers, which surfaces here as a network TypeError ("unavailable").
const NB_BASE = "https://gifs.nostr.build/api/v1";
const GIPHY_BASE = "https://api.giphy.com/v1/gifs";

// nostr.build: one request per query for up to 200, no paging (the grid
// virtualises media itself). Giphy is the temporary fallback only.
const NB_LIMIT = 200;
const GIPHY_LIMIT = 24;
const TIMEOUT_MS = 15_000;
export const GIF_KINDS = [
  ["reaction", "Reactions"],
  ["meme", "Memes"],
  ["cute", "Cute"],
  ["art", "Art"],
  ["sport", "Sport"],
];
export const GIF_REPORT_REASONS = ["sexual", "violent", "hateful", "harassment", "illegal", "spam", "other"];

export class GifApiError extends Error {
  constructor(code, status, message) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

const _cache = new Map();

const timeoutSignal = () =>
  typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(TIMEOUT_MS) : undefined;

async function getJson(url, cacheKey) {
  if (cacheKey && _cache.has(cacheKey)) return _cache.get(cacheKey);
  const ask = () => fetch(url, { signal: timeoutSignal() });
  let res;
  try {
    try {
      res = await ask();
    } catch (e) {
      // Not reached at all (TypeError): once more, a second later. A timeout
      // may have reached the API and been counted, so it isn't retried.
      if (!(e instanceof TypeError)) throw e;
      await new Promise(r => setTimeout(r, 1000));
      res = await ask();
    }
  } catch (e) {
    throw new GifApiError(e?.name === "TimeoutError" ? "timeout" : "unavailable", 0);
  }
  let body = null;
  try { body = await res.json(); } catch {}
  if (!res.ok) {
    throw new GifApiError(body?.error?.code || `http_${res.status}`, res.status, body?.error?.message || body?.message);
  }
  if (cacheKey) _cache.set(cacheKey, body);
  return body;
}

function nbUrl(path, params) {
  const u = new URL(NB_BASE + path);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, String(v));
  return u.toString();
}

function normalizeNb(item) {
  const p = item.previews?.w240 || item.previews?.medium || item.previews?.small || {};
  return {
    id: item.id,
    provider: "nostrbuild",
    url: item.url,
    preview: p.animated || item.url,
    still: p.still || p.animated || item.url,
    width: item.width,
    height: item.height,
    bytes: item.bytes ?? null,
    mime: item.format ? `image/${item.format}` : null,
    alt: item.title || null,
    raw: item, // what gifGrid renders from (mp4, lqip, previews)
  };
}

function normalizeGiphy(g) {
  const orig = g.images?.original || {};
  const small = g.images?.fixed_height_small || g.images?.fixed_height || {};
  return {
    id: g.id,
    provider: "giphy",
    url: orig.url || g.images?.downsized?.url,
    preview: small.url || orig.url,
    still: g.images?.fixed_height_small_still?.url || small.url || orig.url,
    width: Number(orig.width) || null,
    height: Number(orig.height) || null,
    bytes: Number(orig.size) || null,
    mime: "image/gif",
    alt: g.title || null,
  };
}

/** `q` must already be normalised (normaliseGifQuery): one spelling, one cache key. */
export async function nbSearch(q) {
  const j = await getJson(nbUrl("/search", { q, limit: NB_LIMIT }), `nb|search|${q}`);
  return (j.items || []).map(normalizeNb);
}

export async function nbBrowse(kind) {
  const j = await getJson(nbUrl("/gifs", { kind, limit: NB_LIMIT }), `nb|browse|${kind}`);
  return (j.items || []).map(normalizeNb);
}

export async function nbSuggest(q) {
  const url = nbUrl("/suggest", { q, limit: 6 });
  const j = await getJson(url, `nb|suggest|${q}`);
  const terms = j.terms || [];
  const exact = terms.filter(t => !t.fuzzy);
  return (exact.length ? exact : terms).map(t => t.term);
}

export function nbReport(id, reason) {
  return fetch(`${NB_BASE}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, reason }),
  }).catch(() => {});
}

export async function giphySearch(q) {
  const url = `${GIPHY_BASE}/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=${GIPHY_LIMIT}&rating=g`;
  const j = await getJson(url, `giphy|search|${q}`);
  return (j.data || []).map(normalizeGiphy);
}

export async function giphyTrending() {
  const url = `${GIPHY_BASE}/trending?api_key=${GIPHY_KEY}&limit=${GIPHY_LIMIT}&rating=g`;
  const j = await getJson(url, "giphy|trending");
  return (j.data || []).map(normalizeGiphy);
}
