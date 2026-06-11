import { useState, memo } from "react";
import { createPortal } from "react-dom";
import ListingDetailModal from "./ListingDetailModal.jsx";

function ListingCard({ event, profiles, myPubkey, onOpenProfile, publishEvent, onDelete, onUpdated, delay = 0 }) {
  const [detailOpen, setDetailOpen] = useState(false);

  const title    = event.tags?.find(t => t[0] === "title")?.[1]   || "";
  const summary  = event.tags?.find(t => t[0] === "summary")?.[1] || "";
  const image    = event.tags?.find(t => t[0] === "image")?.[1]   || null;
  const status   = event.tags?.find(t => t[0] === "status")?.[1]  || "";
  const priceTag = event.tags?.find(t => t[0] === "price");

  const isDraft = event.kind === 30403;
  const isSold  = status === "sold";

  let priceDisplay = null;
  if (priceTag) {
    const [, amount, currency, frequency] = priceTag;
    priceDisplay = `${amount} ${(currency || "").toUpperCase()}${frequency ? ` / ${frequency}` : ""}`;
  }

  return (
    <>
      <div
        className="listing-tile"
        style={{ animationDelay: `${delay}s`, cursor: "pointer" }}
        onClick={() => setDetailOpen(true)}
      >
        <div className="listing-tile-image">
          {image
            ? <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            : <div className="listing-tile-placeholder">◎</div>
          }
          {isSold  && <span className="listing-tile-badge listing-tile-badge--sold">Sold</span>}
          {isDraft && <span className="listing-tile-badge listing-tile-badge--draft">Draft</span>}
        </div>
        <div className="listing-tile-body">
          {title        && <div className="listing-tile-title">{title}</div>}
          {priceDisplay && <div className="listing-tile-price">{priceDisplay}</div>}
          {summary      && <div className="listing-tile-summary">{summary}</div>}
        </div>
      </div>

      {detailOpen && createPortal(
        <ListingDetailModal
          event={event}
          profiles={profiles}
          myPubkey={myPubkey}
          onOpenProfile={onOpenProfile}
          publishEvent={publishEvent}
          onDelete={onDelete}
          onUpdated={onUpdated}
          onClose={() => setDetailOpen(false)}
        />,
        document.body
      )}
    </>
  );
}

export default memo(ListingCard);
