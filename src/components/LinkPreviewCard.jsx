import { useState, useEffect, useRef } from "react";
import { fetchLinkPreview } from "../utils/linkPreview.js";

export default function LinkPreviewCard({ url }) {
  const [state,   setState]   = useState("idle"); // idle | loading | loaded | failed
  const [preview, setPreview] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState(s => s === "idle" ? "loading" : s);
          obs.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (state !== "loading") return;
    let cancelled = false;
    fetchLinkPreview(url).then(d => {
      if (cancelled) return;
      if (d) { setPreview(d); setState("loaded"); }
      else setState("failed");
    });
    return () => { cancelled = true; };
  }, [state, url]);

  if (state === "failed") return null;

  let hostname = url;
  try { hostname = new URL(url).hostname.replace(/^www\./, ""); } catch {}

  return (
    <a
      ref={ref}
      className="link-preview-card"
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={e => e.stopPropagation()}
    >
      {state === "loaded" ? (
        <>
          {preview.image && (
            <div className="link-preview-image">
              <img
                src={preview.image}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={e => { e.target.closest(".link-preview-image")?.remove(); }}
              />
            </div>
          )}
          <div className="link-preview-body">
            <div className="link-preview-host">{preview.siteName || hostname}</div>
            <div className="link-preview-title">{preview.title}</div>
            {preview.description && (
              <div className="link-preview-desc">{preview.description}</div>
            )}
          </div>
        </>
      ) : (
        <div className="link-preview-skel">
          <div className="link-preview-skel-line" />
          <div className="link-preview-skel-line link-preview-skel-short" />
        </div>
      )}
    </a>
  );
}
