/**
 * Cloudflare Worker — Open Graph link preview proxy.
 *
 * Deploy:
 *   npx wrangler deploy worker/link-preview.js --name link-preview --compatibility-date 2024-01-01
 *
 * Then set VITE_LINK_PREVIEW_WORKER=https://link-preview.<your-subdomain>.workers.dev in .env.local
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get("url");
    if (!target) return json(null, 400);

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return json(null, 400);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return json(null, 400);

    try {
      const res = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en",
        },
        redirect: "follow",
        // Cloudflare edge cache: serve cached responses for 24h
        cf: { cacheEverything: true, cacheTtl: 86400 },
      });

      if (!res.ok) return json(null);
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("html")) return json(null);

      // Read up to 200KB — most OG tags are in <head> but some SSR frameworks
      // (e.g. Next.js streaming) inject them later in the response body.
      const reader = res.body.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        total += value.length;
        if (total >= 200_000) { reader.cancel(); break; }
      }
      const html = new TextDecoder().decode(
        chunks.reduce((acc, c) => { const merged = new Uint8Array(acc.length + c.length); merged.set(acc); merged.set(c, acc.length); return merged; }, new Uint8Array(0))
      );

      const data = parseOG(html, parsed) ?? parseRSC(html, parsed);
      return json(data, 200, { "Cache-Control": "public, max-age=86400" });
    } catch {
      return json(null);
    }
  },
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extra },
  });
}

function meta(html, ...props) {
  for (const prop of props) {
    const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const re of [
      new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"'<>]{1,500})["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"'<>]{1,500})["'][^>]+(?:property|name)=["']${esc}["']`, "i"),
    ]) {
      const m = re.exec(html);
      if (m) return m[1].trim();
    }
  }
  return null;
}

function resolveUrl(base, url) {
  if (!url) return null;
  try { return new URL(url, base).href; } catch { return null; }
}

// Fallback for Next.js App Router, which streams OG data as escaped JSON inside
// self.__next_f.push() blocks rather than as real <meta> elements.
// In the raw HTML these appear as: \"property\":\"og:title\",\"content\":\"VALUE\"
function parseRSC(html, base) {
  function get(prop) {
    const re = new RegExp(`\\\\"property\\\\":\\\\"${prop}\\\\"[^}]*\\\\"content\\\\":\\\\"([^"\\\\]*)`);
    const m = re.exec(html);
    // RSC lazy refs look like "$16" — skip them
    return (m && !m[1].startsWith("$")) ? m[1] : null;
  }
  const title = get("og:title");
  if (!title) return null;
  const image = get("og:image");
  return {
    title:       htmlDecode(title),
    description: htmlDecode(get("og:description")),
    image:       image ? resolveUrl(base, image) : null,
    siteName:    htmlDecode(get("og:site_name")),
  };
}

function htmlDecode(s) {
  if (!s) return null;
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

function parseOG(html, base) {
  const titleTag = /<title[^>]*>([^<]{1,300})<\/title>/i.exec(html);
  const title       = meta(html, "og:title", "twitter:title") || titleTag?.[1]?.trim() || null;
  const description = meta(html, "og:description", "twitter:description", "description");
  const image       = resolveUrl(base, meta(html, "og:image", "twitter:image:src", "twitter:image"));
  const siteName    = meta(html, "og:site_name");

  if (!title) return null;
  return {
    title:       htmlDecode(title),
    description: htmlDecode(description),
    image,
    siteName,
  };
}
