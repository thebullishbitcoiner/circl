import { createPortal } from "react-dom";
import { FEED_KIND_GROUPS, groupDisplayLabel } from "../feedFilters.js";

/**
 * Home-feed filter. Currently just a per-content-type on/off list; additional
 * filter sections (hide replies, time window, …) belong here as further
 * .settings-section-title blocks writing other keys through useFeedFilterSettings.
 */
export default function FeedFilterModal({ kindGroups, setKindGroups, onClose }) {
  const toggle = id => {
    setKindGroups(
      kindGroups.includes(id)
        ? kindGroups.filter(x => x !== id)
        : [...kindGroups, id]
    );
  };

  return createPortal(
    <div className="overlay centered" onClick={onClose}>
      <div className="feed-filter-modal" onClick={e => e.stopPropagation()}>
        <div className="note-json-header">
          <div className="note-json-title">Feed filter</div>
          <button type="button" className="note-json-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="settings-section-title">Content</div>
        <div className="feed-filter-list">
          {FEED_KIND_GROUPS.map(g => {
            const on = kindGroups.includes(g.id);
            return (
              <div className="settings-row" key={g.id} onClick={() => toggle(g.id)}>
                <div>
                  <div className="settings-row-label">{groupDisplayLabel(g)}</div>
                </div>
                <label className="toggle" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={on} onChange={() => toggle(g.id)} />
                  <div className="toggle-track" />
                  <div className="toggle-thumb" />
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
