import { useState } from "react";
import Overlay from "./Overlay.jsx";

const FREQUENCIES = ["", "hour", "day", "week", "month", "year"];

export default function CreateListingSheet({ publishEvent, onCreated, onDismiss }) {
  const [title,         setTitle]         = useState("");
  const [summary,       setSummary]       = useState("");
  const [priceAmt,      setPriceAmt]      = useState("");
  const [priceCurrency, setPriceCurrency] = useState("USD");
  const [priceFreq,     setPriceFreq]     = useState("");
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
      const price = ["price", priceAmt.trim(), priceCurrency.trim()];
      if (priceFreq) price.push(priceFreq);
      tags.push(price);
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

  return (
    <Overlay onDismiss={onDismiss} centered>
      <div className="action-sheet highlight-sheet" style={{ maxWidth: 480, width: "100%" }} onClick={e => e.stopPropagation()}>
        <div className="action-sheet-handle" />
        <div className="highlight-sheet-title">New Listing</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px" }}>
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

          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="highlight-sheet-comment"
              style={{ padding: "8px 10px", flex: "1 1 80px", minWidth: 0 }}
              placeholder="Price"
              type="number"
              min="0"
              value={priceAmt}
              onChange={e => setPriceAmt(e.target.value)}
            />
            <input
              className="highlight-sheet-comment"
              style={{ padding: "8px 10px", flex: "1 1 60px", minWidth: 0 }}
              placeholder="Currency"
              value={priceCurrency}
              onChange={e => setPriceCurrency(e.target.value)}
              maxLength={10}
            />
            <select
              className="highlight-sheet-comment"
              style={{ padding: "8px 10px", flex: "1 1 80px", minWidth: 0, cursor: "pointer" }}
              value={priceFreq}
              onChange={e => setPriceFreq(e.target.value)}
            >
              <option value="">One-time</option>
              {FREQUENCIES.filter(Boolean).map(f => (
                <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}ly</option>
              ))}
            </select>
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
        </div>

        {error && <div className="highlight-sheet-error" style={{ margin: "8px 16px 0" }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, padding: "12px 16px 0" }}>
          <button
            type="button"
            className="action-sheet-btn highlight-sheet-submit"
            style={{ flex: 1 }}
            onClick={() => handleSubmit(30402)}
            disabled={busy}
          >
            {busy ? "Publishing…" : "Publish"}
          </button>
          <button
            type="button"
            className="action-sheet-btn"
            style={{ flex: 1, background: "var(--surface-2, var(--border))", color: "var(--text)" }}
            onClick={() => handleSubmit(30403)}
            disabled={busy}
          >
            Save Draft
          </button>
        </div>
        <button type="button" className="action-sheet-cancel" onClick={onDismiss}>Cancel</button>
      </div>
    </Overlay>
  );
}
