// Masonry GIF grid for gifs.nostr.build results, adapted from the reference
// implementation at https://gifs.nostr.build/developers/grid (see there for the
// reasoning behind each rule). In short:
//  - Tiles play the GIF's MP4 in a <video>, never an animated <img>: WebKit
//    keeps a decoding thread per animated image and freezes at 512.
//  - Videos come from one page-wide pool that is never emptied: every <video>
//    WebKit creates slows every later play/pause until it is collected.
//  - A tile far from view shows only its blurred lqip placeholder. Half a
//    screen away its video loads, paused on the first frame. It plays once a
//    tenth of it is visible. It goes back to the pool when it scrolls away.
//  - Tile heights come from the GIF's own size (ratio clamped to 3:4..2:1),
//    so nothing jumps as media loads.

const API = "https://gifs.nostr.build";
const NEAR = "50% 0px";      // where a tile's video loads, paused
const AHEAD = "150% 0px";    // where its MP4 gets a HEAD to warm the CDN
const SETTLE_MS = 150;       // a tile flung past loads nothing
const ON_SCREEN = 0.1;       // share of a tile visible before it plays
const FADE_MS = 350;         // matches the .gif-tile video transition
const FIRST_FRAME = "#t=0.001"; // makes iOS draw the first frame of a paused video
const MIN_COLUMN = 180;
const GAP = 6;
const PRIME_MS = 60_000;
const PRIMES_AT_ONCE = 3;

/** Trimmed, single-spaced, lowercase, at most 500 UTF-16 units, cut between graphemes. */
export function normaliseGifQuery(q) {
  const s = q.trim().replace(/\s+/g, " ").toLowerCase();
  if (s.length <= 500) return s;
  const parts = typeof Intl.Segmenter === "function"
    ? Array.from(new Intl.Segmenter().segment(s), p => p.segment)
    : Array.from(s);
  let out = "";
  for (const p of parts) {
    if (out.length + p.length > 500) break;
    out += p;
  }
  return out.trimEnd();
}

/** Worth a request: two characters, or one emoji or ideograph. */
export function isSearchableGifQuery(q) {
  if ([...q].length >= 2) return true;
  return /\p{Extended_Pictographic}|\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(q);
}

/** A video URL we'll play: on the API's host, with no `#` of its own. */
function media(url) {
  return typeof url === "string" && url.startsWith(`${API}/`) && !url.includes("#") ? url : null;
}

/** One video file per engine for transparent GIFs (HEVC on Safari, WebM on
 *  Chrome/Firefox); otherwise the MP4. Never let the browser choose. */
function videoOf(gif, ua = navigator.userAgent) {
  const hevc = media(gif.hevc);
  const webm = media(gif.webm);
  if (/AppleWebKit/.test(ua) && !/Chrome\//.test(ua) && hevc) return hevc;
  if (/Chrome\/|Firefox\//.test(ua) && webm) return webm;
  return media(gif.mp4);
}

// --- The video pool, shared by every grid on the page ---------------------

const spare = [];

function borrowVideo() {
  const pooled = spare.pop();
  if (pooled) return pooled;
  const v = document.createElement("video");
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.preload = "auto";
  v.disablePictureInPicture = true;
  v.setAttribute("aria-hidden", "true");
  return v;
}

/** Paused, emptied (load() with no src frees the decoder), detached, pooled. */
function returnVideo(v) {
  v.pause();
  v.removeAttribute("src");
  v.load();
  v.removeAttribute("data-shown");
  v.removeAttribute("data-at-once");
  v.remove();
  spare.push(v);
}

let h264;
/** Some Linux builds can't play H.264; they get animated previews instead. */
function playsH264() {
  if (h264 === undefined) {
    const v = borrowVideo();
    h264 = v.canPlayType('video/mp4; codecs="avc1.4d401e"') !== "";
    spare.push(v);
  }
  return h264;
}

const LQIP_RE = /^data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+$/;

/**
 * Builds a grid inside `container` (its children are replaced).
 * Options: `root` (the scrolling element, null for the page), `maxColumns`,
 * `onPick(gif)`, `onReport(gif)` (adds a ⚑ button per tile when given).
 * `gif` is a raw item from the API.
 */
export function gifGrid(container, { root = null, maxColumns = 3, onPick, onReport } = {}) {
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");
  const WIDE = matchMedia("(min-width: 40rem)");
  const tiles = new Map(); // id -> tile
  let view = 0;            // bumped per show(): an older play() refusal doesn't count
  let refused = false;     // autoplay refused (iOS Low Power Mode): stills until the next show()
  let destroyed = false;

  container.replaceChildren();

  // --- What a tile shows -------------------------------------------------
  const plays = t => !!t.src && (t.src === t.webm || playsH264());
  const look = t => {
    if (!t.near) return "none";
    if (REDUCED.matches || refused) return "still";
    if (plays(t) && !t.videoFailed) return t.on ? "video" : "ready";
    // No playable video: a still may stay while near, an animated <img> only
    // once the tile has settled on screen.
    if (!t.preview.animated || t.animFailed) return "still";
    return t.settled ? "animated" : "none";
  };

  const apply = t => {
    if (!tiles.has(t.gif.id)) return;
    const l = look(t);
    if (l === "video" || l === "ready") showVideo(t, l === "video");
    else stopVideo(t);
    const want = l === "animated" ? t.preview.animated : l === "still" ? t.preview.still : null;
    if (want && t.img.getAttribute("src") !== want) t.img.src = want;
    if (!want && t.img.hasAttribute("src")) {
      t.img.removeAttribute("src");
      if (!t.video?.hasAttribute("data-shown")) blur(t, true);
    }
  };
  const applyAll = () => { for (const t of tiles.values()) apply(t); };

  // The placeholder must go once something is drawn: it would show through
  // transparent GIFs and as thin lines at a video's edges.
  const blur = (t, show) => {
    t.btn.style.backgroundImage = show && t.lqip ? `url("${t.lqip}")` : "";
  };

  const visible = el => {
    const r = el.getBoundingClientRect();
    const top = root ? root.getBoundingClientRect().top : 0;
    const bottom = root ? root.getBoundingClientRect().bottom : innerHeight;
    return r.bottom > top && r.top < bottom;
  };

  const showVideo = (t, play) => {
    let v = t.video;
    if (!v) {
      v = borrowVideo();
      const use = { v, timer: 0 };
      const up = () => blur(t, false);
      use.shown = () => {
        if (v.hasAttribute("data-shown")) return;
        if (!visible(v)) v.setAttribute("data-at-once", "");
        v.setAttribute("data-shown", "");
        if (v.hasAttribute("data-at-once") || t.src !== t.mp4) return up();
        v.addEventListener("transitionend", up, { once: true });
        use.timer = setTimeout(up, FADE_MS + 100);
      };
      use.up = up;
      use.failed = () => {
        if (t.src !== t.mp4 && t.mp4) t.src = t.mp4; // transparent video failed: MP4 on black
        else t.videoFailed = true;
        stopVideo(t);
        apply(t);
      };
      v.addEventListener("loadeddata", use.shown);
      v.addEventListener("playing", use.shown);
      v.addEventListener("error", use.failed);
      t.video = v;
      t.use = use;
      // Set before src, or the browser starts a waiting video by itself.
      v.autoplay = play;
      v.src = t.src + FIRST_FRAME;
      t.btn.append(v);
    }
    if (!play) {
      v.autoplay = false;
      if (!v.paused) v.pause(); // WebKit walks its media sessions on every pause()
      return;
    }
    if (v.autoplay && !v.paused) return;
    v.autoplay = true; // lets WebKit resume it after an interruption
    const asked = view;
    v.play().catch(e => {
      if (e?.name !== "NotAllowedError" || refused || asked !== view) return;
      refused = true;
      primes.clear();
      applyAll();
    });
  };

  const stopVideo = t => {
    const v = t.video;
    if (!v) return;
    const u = t.use;
    v.removeEventListener("loadeddata", u.shown);
    v.removeEventListener("playing", u.shown);
    v.removeEventListener("error", u.failed);
    v.removeEventListener("transitionend", u.up);
    clearTimeout(u.timer);
    t.video = null;
    t.use = null;
    returnVideo(v);
    if (!(t.img.complete && t.img.naturalWidth > 0 && t.img.hasAttribute("src"))) blur(t, true);
  };

  // --- Warming MP4s ahead of the screen, three at a time, each once -------
  const primes = (() => {
    const asked = new Set();
    const waiting = [];
    let busy = 0;
    const next = () => {
      while (busy < PRIMES_AT_ONCE && waiting.length) {
        const src = waiting.shift();
        busy++;
        const signal = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(PRIME_MS) : undefined;
        fetch(src, { method: "HEAD", signal }).catch(() => {}).finally(() => { busy--; next(); });
      }
    };
    return {
      ask(src) {
        if (asked.has(src)) return;
        asked.add(src);
        waiting.push(src);
        next();
      },
      drop(src) {
        const i = waiting.indexOf(src);
        if (i < 0) return;
        waiting.splice(i, 1);
        asked.delete(src);
      },
      clear() {
        for (const src of waiting) asked.delete(src);
        waiting.length = 0;
      },
    };
  })();

  // --- Watching tiles: separate observers, since a rootMargin changes what
  // an intersection ratio measures ----------------------------------------
  const timers = new WeakMap();
  const later = (key, ms, fn) => {
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(fn, ms));
  };
  const tileOf = el => tiles.get(el.dataset.id);
  const nearIO = new IntersectionObserver(entries => {
    for (const e of entries) {
      const t = tileOf(e.target);
      if (!t) continue;
      if (e.isIntersecting) {
        later(t.nearKey, SETTLE_MS, () => {
          t.near = true;
          if (t.src) primes.drop(t.src);
          apply(t);
        });
      } else {
        clearTimeout(timers.get(t.nearKey));
        t.near = false;
        apply(t);
      }
    }
  }, { root, rootMargin: NEAR });
  const onIO = new IntersectionObserver(entries => {
    for (const e of entries) {
      const t = tileOf(e.target);
      if (!t) continue;
      t.on = e.intersectionRatio >= ON_SCREEN;
      if (t.on) {
        later(t.onKey, SETTLE_MS, () => { t.settled = true; apply(t); });
      } else {
        clearTimeout(timers.get(t.onKey));
        t.settled = false;
      }
      apply(t);
    }
  }, { root, threshold: ON_SCREEN });
  const aheadIO = new IntersectionObserver(entries => {
    for (const e of entries) {
      const t = tileOf(e.target);
      if (!t || !plays(t) || REDUCED.matches || refused) continue;
      if (e.isIntersecting && !t.near) primes.ask(t.src);
      else if (!e.isIntersecting) primes.drop(t.src);
    }
  }, { root, rootMargin: AHEAD });
  const onMotion = () => {
    if (REDUCED.matches) primes.clear();
    applyAll();
  };
  REDUCED.addEventListener("change", onMotion);

  // --- Masonry layout: shortest column takes the next tile ---------------
  let width = 0;
  const layout = () => {
    width = container.clientWidth;
    if (!width) return;
    const cols = Math.max(2, Math.min(maxColumns, Math.floor((width + GAP) / (MIN_COLUMN + GAP))));
    const col = (width - GAP * (cols - 1)) / cols;
    const heights = new Array(cols).fill(0);
    for (const t of tiles.values()) {
      const c = heights.indexOf(Math.min(...heights));
      const ratio = Math.min(2, Math.max(0.75, t.gif.width / t.gif.height));
      const h = Math.round(col / ratio);
      Object.assign(t.el.style, {
        left: `${c * (col + GAP)}px`,
        top: `${heights[c]}px`,
        width: `${col}px`,
        height: `${h}px`,
      });
      heights[c] += h + GAP;
    }
    container.style.height = `${Math.max(0, Math.max(...heights) - GAP)}px`;
  };
  const resized = new ResizeObserver(() => {
    if (container.clientWidth !== width) layout();
  });
  resized.observe(container);

  // --- Tiles --------------------------------------------------------------
  const makeTile = (gif, index, total) => {
    const el = document.createElement("div");
    el.className = "gif-cell";
    el.dataset.id = gif.id;
    el.setAttribute("role", "listitem");
    el.setAttribute("aria-setsize", String(total));
    el.setAttribute("aria-posinset", String(index + 1));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gif-tile";
    btn.setAttribute("aria-label", gif.title || "GIF");
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    btn.append(img);
    el.append(btn);
    const preview = (WIDE.matches ? gif.previews?.w480 : null)
      ?? gif.previews?.w240 ?? gif.previews?.medium ?? { animated: null, still: null };
    const t = {
      gif, el, btn, img, preview,
      lqip: LQIP_RE.test(gif.lqip ?? "") ? gif.lqip : null,
      near: false, on: false, settled: false,
      src: videoOf(gif),
      mp4: media(gif.mp4),
      webm: media(gif.webm),
      videoFailed: false, animFailed: false,
      video: null, use: null,
      nearKey: {}, onKey: {},
    };
    img.addEventListener("load", () => {
      const src = img.getAttribute("src");
      if (!src) return;
      img.decode().then(() => { if (img.getAttribute("src") === src) blur(t, false); }, () => {});
    });
    img.addEventListener("error", () => {
      const src = img.getAttribute("src");
      if (!src) return;
      if (src === t.preview.animated) { t.animFailed = true; apply(t); }
      else blur(t, true);
    });
    btn.addEventListener("click", () => onPick?.(gif));
    if (onReport) {
      const report = document.createElement("button");
      report.type = "button";
      report.className = "gif-report-btn";
      report.setAttribute("aria-label", "Report GIF");
      report.textContent = "⚑";
      report.addEventListener("click", () => onReport(gif));
      el.append(report);
    }
    blur(t, true);
    return t;
  };

  const release = t => {
    nearIO.unobserve(t.el);
    onIO.unobserve(t.el);
    aheadIO.unobserve(t.el);
    clearTimeout(timers.get(t.nearKey));
    clearTimeout(timers.get(t.onKey));
    stopVideo(t);
    t.img.removeAttribute("src");
    t.el.remove();
  };
  const clear = () => {
    const old = [...tiles.values()];
    tiles.clear();
    for (const t of old) release(t);
    primes.clear();
  };

  const usable = items => {
    const seen = new Set();
    return items.filter(g => {
      if (!g?.id || seen.has(g.id)) return false;
      seen.add(g.id);
      return g.width > 0 && g.height > 0 && (media(g.mp4) || g.previews);
    });
  };

  return {
    /** Replaces the tiles with `items` (raw API items). */
    show(items) {
      if (destroyed) return;
      clear();
      view++;
      refused = false;
      const list = usable(items);
      list.forEach((gif, i) => {
        const t = makeTile(gif, i, list.length);
        tiles.set(gif.id, t);
        container.append(t.el);
      });
      layout();
      for (const t of tiles.values()) {
        nearIO.observe(t.el);
        onIO.observe(t.el);
        aheadIO.observe(t.el);
      }
    },
    /** Takes one tile out (reported) and closes the gap. */
    remove(id) {
      const t = tiles.get(id);
      if (!t) return;
      tiles.delete(id);
      release(t);
      layout();
    },
    destroy() {
      destroyed = true;
      clear();
      nearIO.disconnect();
      onIO.disconnect();
      aheadIO.disconnect();
      resized.disconnect();
      REDUCED.removeEventListener("change", onMotion);
      container.replaceChildren();
      container.style.height = "";
    },
  };
}
