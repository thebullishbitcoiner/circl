import { useState, useEffect } from "react";
import { fetchLinkPreview } from "../utils/linkPreview.js";

function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export default function PodcastPreviewChip({ url, fallbackLabel = "podcast" }) {
  const [meta, setMeta]       = useState(null);
  const [loading, setLoading] = useState(!!url);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetchLinkPreview(url).then(d => {
      if (cancelled) return;
      setMeta(d);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [url]);

  if (!url) {
    return (
      <span className="highlight-source-chip highlight-source-unknown">
        {fallbackLabel}
      </span>
    );
  }

  if (loading) {
    return <div className="podcast-preview-skel" />;
  }

  if (!meta) {
    return (
      <a
        className="highlight-source-chip"
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={e => e.stopPropagation()}
      >
        {hostname(url)}
      </a>
    );
  }

  return (
    <a
      className="podcast-preview"
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={e => e.stopPropagation()}
    >
      {meta.image && (
        <img
          className="podcast-preview-thumb"
          src={meta.image}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={e => { e.target.style.display = "none"; }}
        />
      )}
      <div className="podcast-preview-body">
        <div className="podcast-preview-host">{meta.siteName || hostname(url)}</div>
        <div className="podcast-preview-title">{meta.title}</div>
      </div>
    </a>
  );
}
