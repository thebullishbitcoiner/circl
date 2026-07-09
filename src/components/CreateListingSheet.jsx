import { useState } from "react";
import { createPortal } from "react-dom";
import Overlay from "./Overlay.jsx";

export default function CreateListingSheet({ publishEvent, onCreated, onDismiss }) {
  const [title,         setTitle]         = useState("");
  const [summary,       setSummary]       = useState("");
  const [priceAmt,      setPriceAmt]      = useState("");
  const [priceCurrency, setPriceCurrency] = useState("sats");
  const [location,      setLocation]      = useState("");
  const [image,         setImage]         = useState("");
  const [description,   setDescription]   = useState("");
  const [hashtags,      setHashtags]      = useState("");
  const [busy,          setBusy]          = useState(false);
  const [error,         setError]         = useState(null);

  const buildTags = () => {
    const now = String(Math.floor(Date.now() / 1000));
    const tags = [
      ["d", now],
      ["published_at", now],
    ];
    if (title)         tags.push(["title", title.trim()]);
    if (summary)       tags.push(["summary", summary.trim()]);
    if (location)      tags.push(["location", location.trim()]);
    if (image.trim())  tags.push(["image", image.trim()]);
    if (priceAmt.trim()) {
      tags.push(["price", priceAmt.trim(), priceCurrency.trim()]);
    }
    for (const tag of hashtags.split(",").map(s => s.trim()).filter(Boolean)) {
      tags.push(["t", tag]);
    }
    return tags;
  };

  const handleSubmit = async (kind) => {
    if (!title.trim()) { setError("Title is required."); return; }
    if (busy) return;
    setBusy(true);
    setError(null);
    const ev = await publishEvent({ kind, content: description, tags: buildTags() });
    setBusy(false);
    if (!ev) {
      setError("Failed to publish. Check your Nostr extension and try again.");
      return;
    }
    onCreated?.(ev);
    onDismiss?.();
  };

  return createPortal(
    <Overlay onDismiss={onDismiss} compose>
      <div style={{ width: "100%", maxWidth: 700, background: "var(--bg)", borderRadius: "20px 20px 0 0", paddingTop: 8, maxHeight: "90vh", display: "flex", flexDirection: "column", animation: "slideUp .22s cubic-bezier(.4,0,.2,1)" }} onClick={e => e.stopPropagation()}>
        <div className="action-sheet-handle" />
        <div className="highlight-sheet-title">New Listing</div>

        {/* Scrollable content — inputs use highlight-sheet-comment class which handles its own margin */}
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
          <input
            className="highlight-sheet-comment"
            style={{ padding: "8px 10px" }}
            placeholder="Title *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={200}
          />
          <input
            className="highlight-sheet-comment"
            style={{ padding: "8px 10px" }}
            placeholder="Summary (short tagline)"
            value={summary}
            onChange={e => setSummary(e.target.value)}
            maxLength={300}
          />
          <textarea
            className="highlight-sheet-comment"
            placeholder="Description (markdown supported)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
          />

          {/* Price row — wrapper provides the 16px inset; items reset class margin/width for flex layout */}
          <div style={{ display: "flex", gap: 8, margin: "0 16px 12px" }}>
            <input
              className="highlight-sheet-comment"
              style={{ padding: "8px 10px", flex: "1 1 80px", minWidth: 0, margin: 0, width: "auto" }}
              placeholder="Price"
              type="number"
              min="0"
              value={priceAmt}
              onChange={e => setPriceAmt(e.target.value)}
            />
            <input
              className="highlight-sheet-comment"
              style={{ padding: "8px 10px", flex: "1 1 60px", minWidth: 0, margin: 0, width: "auto" }}
              placeholder="Currency"
              value={priceCurrency}
              onChange={e => setPriceCurrency(e.target.value)}
              maxLength={10}
            />
          </div>

          <input
            className="highlight-sheet-comment"
            style={{ padding: "8px 10px" }}
            placeholder="Location"
            value={location}
            onChange={e => setLocation(e.target.value)}
            maxLength={200}
          />
          <input
            className="highlight-sheet-comment"
            style={{ padding: "8px 10px" }}
            placeholder="Image URL"
            value={image}
            onChange={e => setImage(e.target.value)}
          />
          <input
            className="highlight-sheet-comment"
            style={{ padding: "8px 10px" }}
            placeholder="Hashtags (comma-separated)"
            value={hashtags}
            onChange={e => setHashtags(e.target.value)}
          />

          {error && <div className="highlight-sheet-error">{error}</div>}
        </div>

        <div style={{ display: "flex", margin: "12px 16px 0", flexShrink: 0, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
          <button
            type="button"
            style={{ flex: 1, padding: "13px 16px", background: "var(--primary)", color: "#fff", border: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: busy ? 0.6 : 1 }}
            onClick={() => handleSubmit(30402)}
            disabled={busy}
          >
            {busy ? "Publishing…" : "Publish"}
          </button>
          <div style={{ width: 1, background: "var(--border)", flexShrink: 0 }} />
          <button
            type="button"
            style={{ flex: 1, padding: "13px 16px", background: "var(--surface)", color: "var(--text)", border: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 500, cursor: "pointer", opacity: busy ? 0.6 : 1 }}
            onClick={() => handleSubmit(30403)}
            disabled={busy}
          >
            Save Draft
          </button>
        </div>
        <button type="button" className="action-sheet-cancel" onClick={onDismiss}>Cancel</button>
      </div>
    </Overlay>,
    document.body
  );
}
