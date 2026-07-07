import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { pool } from "../nostr.js";

export default function NoteDetailsModal({ event, onClose }) {
  const [relays, setRelays] = useState([]);
  const [querying, setQuerying] = useState(true);

  useEffect(() => {
    const relayUrls = [...pool.relays.keys()];
    if (relayUrls.length === 0) {
      setQuerying(false);
      return;
    }

    const found = new Set();
    const sub = pool.group(relayUrls, false).req([{ ids: [event.id] }]).subscribe({
      next: msg => {
        if (msg.type === "EVENT" && msg.event.id === event.id) {
          found.add(msg.from);
          setRelays([...found]);
        }
      },
      complete: () => setQuerying(false),
      error: () => setQuerying(false),
    });

    // Relays don't naturally complete a REQ connection, so cap at 5s
    const timeout = setTimeout(() => {
      setQuerying(false);
      sub.unsubscribe();
    }, 5000);

    return () => {
      clearTimeout(timeout);
      sub.unsubscribe();
    };
  }, [event.id]);

  return createPortal(
    <div className="overlay centered" onClick={e => e.stopPropagation()}>
      <div className="note-json-modal" onClick={e => e.stopPropagation()}>
        <div className="note-json-header">
          <div className="note-json-title">Post Details</div>
          <button type="button" className="note-json-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="note-details-body">
          <div className="note-details-section-label">
            Received from{querying && <span className="relay-querying"> — querying…</span>}
          </div>
          {relays.length > 0
            ? relays.map(url => <div key={url} className="relay-pill">{url}</div>)
            : <div className="relay-empty">
                {querying ? "Checking relays…" : "No relays responded"}
              </div>
          }
        </div>
      </div>
    </div>,
    document.body
  );
}
