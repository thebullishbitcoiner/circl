import { Cl } from "./icons.jsx";
import { parseArticle } from "../utils.js";

export default function LongformInlineCard({ event, onOpen }) {
  const art = parseArticle(event);
  return (
    <div className="lf-inner" style={{ marginBottom: 6 }} onClick={e => { e.stopPropagation(); onOpen?.(event); }}>
      {art.image ? (
        <img className="lf-image" src={art.image} alt={art.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      ) : (
        <div className="lf-placeholder">✦</div>
      )}
      <div className="lf-body">
        <div className="lf-title">{art.title}</div>
        <div className="lf-summary">{art.summary}</div>
        {art.hashtags?.length ? (
          <div className="lf-hashtags">
            {art.hashtags.slice(0, 4).map(t => <span key={t}>#{t}</span>)}
          </div>
        ) : null}
        <div className="lf-footer">
          <span className="lf-readtime"><Cl />{art.readtime}</span>
        </div>
      </div>
    </div>
  );
}
