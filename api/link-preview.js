/**
 * Vercel serverless — Open Graph / basic meta for link preview cards.
 * GET /api/link-preview?url=https%3A%2F%2Fexample.com
 */

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 600_000;

function decodeBasicEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x20;/gi, " ");
}

function metaContent(html, prop) {
  const p = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(
    `<meta\\s[^>]*property=["']${p}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const re2 = new RegExp(
    `<meta\\s[^>]*content=["']([^"']*)["'][^>]*property=["']${p}["']`,
    "i"
  );
  const reN = new RegExp(
    `<meta\\s[^>]*name=["']${p}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const reN2 = new RegExp(
    `<meta\\s[^>]*content=["']([^"']*)["'][^>]*name=["']${p}["']`,
    "i"
  );
  let m = html.match(re1) || html.match(re2) || html.match(reN) || html.match(reN2);
  if (!m) return null;
  return decodeBasicEntities(m[1].trim());
}

function titleFromHtml(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? decodeBasicEntities(m[1].trim()) : null;
}

function resolveUrl(base, ref) {
  if (!ref) return null;
  try {
    return new URL(ref, base).href;
  } catch {
    return null;
  }
}

function isBlockedHost(hostname) {
  const h = (hostname || "").toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0" || h === "[::1]" || h === "::1") return true;
  if (h.startsWith("127.")) return true;
  if (h.startsWith("10.")) return true;
  if (h.startsWith("192.168.")) return true;
  if (h.startsWith("172.")) {
    const p = h.split(".");
    const n = parseInt(p[1], 10);
    if (n >= 16 && n <= 31) return true;
  }
  if (h.startsWith("169.254.")) return true;
  if (h.endsWith(".internal")) return true;
  return false;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const rawUrl = typeof req.query?.url === "string" ? req.query.url : "";
  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    res.status(400).json({ ok: false, error: "invalid_url" });
    return;
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    res.status(400).json({ ok: false, error: "invalid_scheme" });
    return;
  }

  if (isBlockedHost(target.hostname)) {
    res.status(400).json({ ok: false, error: "blocked_host" });
    return;
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);

  try {
    const r = await fetch(target.href, {
      signal: ac.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CirclBot/1.0; +https://github.com) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!r.ok) {
      res.status(502).json({ ok: false, error: "upstream_status", status: r.status });
      return;
    }

    const ct = r.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml\+xml/i.test(ct) && !ct.includes("text/")) {
      res.status(200).json({
        ok: true,
        data: {
          title: target.href,
          description: "",
          image: null,
        },
      });
      return;
    }

    const buf = await r.arrayBuffer();
    const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);

    const title =
      metaContent(html, "og:title") ||
      metaContent(html, "twitter:title") ||
      titleFromHtml(html) ||
      target.href;
    const description =
      metaContent(html, "og:description") ||
      metaContent(html, "twitter:description") ||
      metaContent(html, "description") ||
      "";
    const imageRaw =
      metaContent(html, "og:image") || metaContent(html, "twitter:image") || metaContent(html, "twitter:image:src");
    const imageUrl = imageRaw ? resolveUrl(target.href, imageRaw) : null;

    res.status(200).json({
      ok: true,
      data: {
        title,
        description,
        image: imageUrl ? { url: imageUrl } : null,
      },
    });
  } catch (e) {
    const msg = e?.name === "AbortError" ? "timeout" : "fetch_failed";
    res.status(504).json({ ok: false, error: msg });
  } finally {
    clearTimeout(t);
  }
}
