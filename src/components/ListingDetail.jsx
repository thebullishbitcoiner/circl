import { useState } from "react";
import { createPortal } from "react-dom";
import NoteContent, { MediaMosaic } from "./NoteContent.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import ZapOutModal from "./ZapOutModal.jsx";
import MediaLightbox from "./MediaLightbox.jsx";
import TagChipInput from "./TagChipInput.jsx";
import ListingImageUpload from "./ListingImageUpload.jsx";
import { relativeTime, nip19 } from "../utils.js";
import { broadcastEvent } from "../nostr.js";

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
  fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none",
};

function ListingContextMenu({ event, onClose, onViewJson, onDelete }) {
  const copyId = () => {
    let encoded = event.id || "";
    try { encoded = "nostr:" + nip19.neventEncode({ id: event.id }); } catch {}
    navigator.clipboard?.writeText(encoded).catch(() => {});
    onClose();
  };
  return (
    <div className="note-card-menu" onClick={e => e.stopPropagation()}>
      <button type="button" className="note-card-menu-item" onClick={copyId}>Copy Note ID</button>
      <button type="button" className="note-card-menu-item" onClick={() => { broadcastEvent(event); onClose(); }}>Broadcast</button>
      <button type="button" className="note-card-menu-item" onClick={() => { onClose(); onViewJson(); }}>View JSON</button>
      {onDelete && (
        <button type="button" className="note-card-menu-item note-card-menu-item--danger" onClick={() => { onDelete(); onClose(); }}>
          Request Delete
        </button>
      )}
    </div>
  );
}

export default function ListingDetail({ event, profiles, myPubkey, blossomServers, onOpenProfile, publishEvent, onDelete, onUpdated, onBack }) {
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [jsonOpen,      setJsonOpen]      = useState(false);
  const [zapOutOpen,    setZapOutOpen]    = useState(false);
  const [lightboxOpen,  setLightboxOpen]  = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [busy,          setBusy]          = useState(false);
  const [error,         setError]         = useState(null);

  const isOwn        = event.pubkey === myPubkey;
  const sellerLnAddr = profiles?.[event.pubkey]?.lud16 || profiles?.[event.pubkey]?.lud06 || null;

  const initTitle    = event.tags?.find(t => t[0] === "title")?.[1]    || "";
  const initSummary  = event.tags?.find(t => t[0] === "summary")?.[1]  || "";
  const initImages   = event.tags?.filter(t => t[0] === "image").map(t => t[1])  || [];
  const initLocation = event.tags?.find(t => t[0] === "location")?.[1] || "";
  const initStatus   = event.tags?.find(t => t[0] === "status")?.[1]   || "active";
  const initPriceTag = event.tags?.find(t => t[0] === "price");
  const initHashtags = event.tags?.filter(t => t[0] === "t").map(t => t[1]) || [];

  const [editTitle,    setEditTitle]    = useState(initTitle);
  const [editSummary,  setEditSummary]  = useState(initSummary);
  const [editPriceAmt, setEditPriceAmt] = useState(initPriceTag?.[1] || "");
  const [editCurrency, setEditCurrency] = useState(initPriceTag?.[2] || "USD");
  const [editLocation, setEditLocation] = useState(initLocation);
  const [editImages,   setEditImages]   = useState(initImages);
  const [editDesc,     setEditDesc]     = useState(event.content || "");
  const [editHashtags, setEditHashtags] = useState(initHashtags);
  const [editStatus,   setEditStatus]   = useState(initStatus);
  const [editKind,     setEditKind]     = useState(event.kind);

  const handleSave = async () => {
    if (!editTitle.trim()) { setError("Title is required."); return; }
    if (busy) return;
    setBusy(true);
    setError(null);

    const dTag        = event.tags?.find(t => t[0] === "d")?.[1]            ?? "";
    const publishedAt = event.tags?.find(t => t[0] === "published_at")?.[1] ?? String(Math.floor(Date.now() / 1000));

    const tags = [["d", dTag], ["published_at", publishedAt]];
    if (editTitle.trim())    tags.push(["title",    editTitle.trim()]);
    if (editSummary.trim())  tags.push(["summary",  editSummary.trim()]);
    if (editLocation.trim()) tags.push(["location", editLocation.trim()]);
    for (const url of editImages) tags.push(["image", url]);
    if (editStatus)          tags.push(["status",   editStatus]);
    if (editPriceAmt.trim()) {
      tags.push(["price", editPriceAmt.trim(), editCurrency.trim()]);
    }
    for (const tag of editHashtags) tags.push(["t", tag]);

    const ev = await publishEvent({ kind: editKind, content: editDesc, tags });
    setBusy(false);
    if (!ev) { setError("Failed to save. Check your Nostr extension and try again."); return; }
    onUpdated?.(event.id, ev);
    onBack();
  };

  const handleDelete = (publishEvent && isOwn)
    ? async () => {
        const dTag = event.tags?.find(t => t[0] === "d")?.[1] ?? "";
        await publishEvent({ kind: 5, content: "", tags: [["a", `${event.kind}:${event.pubkey}:${dTag}`], ["e", event.id]] });
        onDelete?.(event.id);
        onBack();
      }
    : null;

  const title      = initTitle;
  const location   = initLocation;
  const status     = initStatus;
  const priceTag   = initPriceTag;
  const hashtags   = initHashtags;
  const isDraft    = event.kind === 30403;
  const isSold     = status === "sold";
  const mosaicItems = initImages.map(url => ({ url, type: "image" }));

  let priceDisplay = null;
  if (priceTag) {
    const [, amount, currency, frequency] = priceTag;
    priceDisplay = `${amount} ${currency || ""}${frequency ? ` / ${frequency}` : ""}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid var(--border)", position: "relative" }}>
        <button
          type="button"
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 13, padding: "4px 0", fontFamily: "'DM Sans', sans-serif" }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6" /></svg>
          Listings
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" className="note-card-menu-btn" onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }} aria-label="More options">
          <span /><span /><span />
        </button>
        {menuOpen && (
          <ListingContextMenu event={event} onClose={() => setMenuOpen(false)} onViewJson={() => setJsonOpen(true)} onDelete={handleDelete} />
        )}
      </div>

      {isOwn ? (
        /* ── Edit mode ── */
        <div style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          <ListingImageUpload images={editImages} onChange={setEditImages} myPubkey={myPubkey} blossomServers={blossomServers} />
          <input style={inputStyle} placeholder="Title *" value={editTitle} onChange={e => setEditTitle(e.target.value)} maxLength={200} />
          <input style={inputStyle} placeholder="Summary (short tagline)" value={editSummary} onChange={e => setEditSummary(e.target.value)} maxLength={300} />
          <textarea style={{ ...inputStyle, resize: "vertical" }} placeholder="Description (markdown supported)" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ ...inputStyle, flex: "1 1 70px", minWidth: 0 }} placeholder="Price" type="number" min="0" value={editPriceAmt} onChange={e => setEditPriceAmt(e.target.value)} />
            <input style={{ ...inputStyle, flex: "1 1 55px", minWidth: 0 }} placeholder="Currency" value={editCurrency} onChange={e => setEditCurrency(e.target.value)} maxLength={10} />
          </div>
          <input style={inputStyle} placeholder="Location" value={editLocation} onChange={e => setEditLocation(e.target.value)} maxLength={200} />
          <TagChipInput tags={editHashtags} onChange={setEditHashtags} placeholder="Add hashtags…" style={inputStyle} />
          <div style={{ display: "flex", gap: 6 }}>
            <select style={{ ...inputStyle, flex: 1 }} value={editStatus} onChange={e => setEditStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="sold">Sold</option>
            </select>
            <select style={{ ...inputStyle, flex: 1 }} value={editKind} onChange={e => setEditKind(Number(e.target.value))}>
              <option value={30402}>Published</option>
              <option value={30403}>Draft</option>
            </select>
          </div>
          {error && <div className="highlight-sheet-error">{error}</div>}
          <div style={{ paddingBottom: 16 }}>
            <button type="button" className="action-sheet-btn highlight-sheet-submit" style={{ width: "100%", justifyContent: "center" }} onClick={handleSave} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        /* ── View mode ── */
        <>
          {mosaicItems.length > 0 && (
            <div style={{ padding: "12px 16px 0" }}>
              <MediaMosaic items={mosaicItems} onItemClick={i => { setLightboxIndex(i); setLightboxOpen(true); }} />
            </div>
          )}
          <div style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              {title && <span style={{ fontWeight: 700, fontSize: 17, flex: 1, minWidth: 0 }}>{title}</span>}
              {isSold  && <span className="zap-goal-badge zap-goal-badge-closed">Sold</span>}
              {isDraft && <span className="zap-goal-badge" style={{ background: "var(--border)", color: "var(--text-faint)" }}>Draft</span>}
            </div>
            {priceDisplay && <div style={{ fontSize: 16, fontWeight: 700, color: "var(--primary)", marginBottom: 8 }}>{priceDisplay}</div>}
            {initSummary && <div style={{ fontSize: 14, color: "var(--text-secondary, var(--text-faint))", marginBottom: 10 }}>{initSummary}</div>}
            {location && (
              <div style={{ fontSize: 13, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                {location}
              </div>
            )}
            {event.content && (
              <NoteContent content={event.content} tags={event.tags} profiles={profiles} onOpenProfile={onOpenProfile} allowEmbeds={false} className="note-text" />
            )}
            {hashtags?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {hashtags.map(tag => (
                  <span key={tag} style={{ fontSize: 12, color: "var(--primary)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 50, padding: "2px 10px" }}>#{tag}</span>
                ))}
              </div>
            )}
          </div>
          {sellerLnAddr && (
            <div style={{ padding: "0 16px 16px" }}>
              <button type="button" className="zap-send-btn" style={{ width: "100%" }} onClick={() => setZapOutOpen(true)}>
                ⚡ Zap Out
              </button>
            </div>
          )}
        </>
      )}

      {lightboxOpen && mosaicItems.length > 0 && (
        <MediaLightbox
          items={mosaicItems}
          index={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onIndexChange={setLightboxIndex}
        />
      )}
      {jsonOpen && createPortal(
        <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />,
        document.body
      )}
      {zapOutOpen && createPortal(
        <ZapOutModal event={event} sellerLnAddr={sellerLnAddr} onClose={() => setZapOutOpen(false)} />,
        document.body
      )}
    </div>
  );
}
