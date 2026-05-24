import { useState, useEffect, useRef } from "react";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";
import { relativeTime, displayName } from "../utils.js";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import { Bk } from "./icons.jsx";

export default function HashtagFeed({ hashtag, profiles, onBack, onOpenProfile, onOpenThread, onOpenHashtag }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const subRef = useRef(null);

  useEffect(() => {
    if (!hashtag) return;
    setNotes([]);
    setLoading(true);

    const sub = pool.subscription(RELAYS, {
      kinds: [1],
      "#t": [hashtag.toLowerCase()],
      limit: 50,
    }).subscribe({
      next: ev => {
        eventStore.add(ev);
        setNotes(prev => {
          if (prev.some(e => e.id === ev.id)) return prev;
          return [ev, ...prev].sort((a, b) => b.created_at - a.created_at);
        });
      },
      error: () => setLoading(false),
      complete: () => setLoading(false),
    });

    subRef.current = sub;
    const t = setTimeout(() => setLoading(false), 4000);
    return () => { sub.unsubscribe(); clearTimeout(t); };
  }, [hashtag]);

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <button type="button" className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span className="panel-bar-logo">#{hashtag}</span>
      </div>

      {loading && notes.length === 0 && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <div style={{ width: 22, height: 22, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        </div>
      )}

      {!loading && notes.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 48 }}>
          <div className="empty-state-title">No notes found</div>
          <div className="empty-state-sub">#{hashtag}</div>
        </div>
      )}

      {notes.map(ev => (
        <div
          key={ev.id}
          className="note-card"
          style={{ cursor: "pointer" }}
          onClick={() => onOpenThread?.(ev)}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpenThread?.(ev); }}
        >
          <div className="note-inner">
            <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={e => { e.stopPropagation(); onOpenProfile?.(ev.pubkey); }}>
              <Avatar pk={ev.pubkey} profiles={profiles} size={36} />
            </div>
            <div className="note-body">
              <div className="note-meta">
                <span className="note-name" style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(ev.pubkey); }}>
                  {displayName(ev.pubkey, profiles)}
                </span>
                <span className="note-time">{relativeTime(ev.created_at)}</span>
              </div>
              <NoteContent
                content={ev.content}
                profiles={profiles}
                onOpenProfile={onOpenProfile}
                onOpenThread={onOpenThread}
                onOpenHashtag={onOpenHashtag}
                allEvents={[]}
                collapsible
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
