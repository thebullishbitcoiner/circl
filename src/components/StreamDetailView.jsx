import { useState, useEffect, useRef } from "react";
import Avatar from "./Avatar.jsx";
import { Bk } from "./icons.jsx";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import { displayName, relativeTime, parseStreamEvent } from "../utils.js";
import useStreamChat from "../hooks/useStreamChat.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

function StatusBadge({ status }) {
  return (
    <span className={`stream-status-badge stream-status-${status}`}>
      {status === "live" && <span className="stream-live-dot" />}
      {status.toUpperCase()}
    </span>
  );
}

function StreamPlayer({ urls }) {
  const hlsUrl = urls.find(u => u.includes(".m3u8"));
  const directUrl = urls.find(u => /\.(mp4|webm|ogg|mov)(\?|$)/i.test(u));
  const playUrl = directUrl || hlsUrl;

  if (!playUrl) return null;

  return (
    <div className="stream-player-wrap">
      <video
        className="stream-video"
        src={playUrl}
        controls
        autoPlay={false}
        playsInline
        preload="metadata"
      />
      {hlsUrl && !directUrl && (
        <div className="stream-hls-note">
          If playback doesn't work, <a href={hlsUrl} target="_blank" rel="noopener noreferrer">open in external player</a>
        </div>
      )}
    </div>
  );
}

export default function StreamDetailView({ event, profiles, pubkey, onBack, onOpenProfile }) {
  const ref = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const stream = parseStreamEvent(event);
  const { messages } = useStreamChat(event);
  const chatRef = useRef(null);

  const hostPks = (() => {
    const tagged = event.tags.filter(t => t[0] === "p" && t[3]?.toLowerCase() === "host").map(t => t[1]);
    return tagged.length > 0 ? tagged : [stream.host?.pubkey ?? event.pubkey];
  })();

  // Fetch all host profiles
  useEffect(() => {
    if (!hostPks.length) return;
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    pool.request(relayUrls, [{ kinds: [0], authors: hostPks }]).subscribe({
      next: ev => eventStore.add(ev),
    });
  }, [hostPks.join(",")]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <>
    <div ref={ref} className="slide-panel-scroll">
      <div className="panel-bar">
        <button className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span className="panel-bar-logo">Stream</span>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="note-card-menu-btn"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            aria-label="More options"
          >
            <span /><span /><span />
          </button>
          {menuOpen && (
            <NoteContextMenu event={event} onClose={() => setMenuOpen(false)} onViewJson={() => { setJsonOpen(true); setMenuOpen(false); }} />
          )}
        </div>
      </div>

      {stream.streamingURLs.length > 0 ? (
        <StreamPlayer urls={stream.streamingURLs} />
      ) : stream.image ? (
        <div className="reader-hero">
          <img className="reader-hero-image" src={stream.image} alt={stream.title} loading="eager" decoding="async" referrerPolicy="no-referrer" />
        </div>
      ) : null}

      <div className="reader-content">
        <div className="reader-header" style={{ borderBottom: "none", marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <StatusBadge status={stream.status} />
            {stream.status === "live" && stream.viewers != null && (
              <span className="stream-viewer-count">{stream.viewers} watching</span>
            )}
          </div>

          <div className="reader-title">{stream.title || "Untitled Stream"}</div>
          {stream.summary && (() => {
            const text = stream.summary.replace(/\\\n/g, "\n");
            const long = text.length > 200;
            return (
              <>
                <div style={{ position: "relative" }}>
                  <div
                    className="reader-summary"
                    style={{ whiteSpace: "pre-wrap", ...(long && !summaryExpanded ? { maxHeight: 72, overflow: "hidden" } : {}) }}
                  >
                    {text}
                  </div>
                  {long && !summaryExpanded && <div className="note-content-fade" />}
                </div>
                {long && (
                  <button type="button" className="note-content-more-btn" onClick={() => setSummaryExpanded(v => !v)}>
                    {summaryExpanded ? "Show less" : "Show more"}
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ transform: summaryExpanded ? "rotate(180deg)" : undefined, transition: "transform .2s" }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                )}
              </>
            );
          })()}

          {stream.hashtags?.length ? (
            <div className="reader-hashtags">
              {stream.hashtags.map(t => <span key={t}>#{t}</span>)}
            </div>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            <div className="host-avatars">
              {hostPks.map((pk, i) => (
                <div key={pk} className="host-av-wrap" style={{ zIndex: hostPks.length - i }} onClick={() => onOpenProfile?.(pk)}>
                  <Avatar pk={pk} profiles={profiles} size={34} />
                </div>
              ))}
            </div>
            <div className="r-author-name">
              {hostPks.map((pk, i) => (
                <span key={pk}>
                  {i > 0 && ", "}
                  <span style={{ cursor: "pointer" }} onClick={() => onOpenProfile?.(pk)}>{displayName(pk, profiles)}</span>
                </span>
              ))}
            </div>
            {stream.startTime && (
              <>
                <div className="meta-sep" />
                <span className="meta-pill">started {relativeTime(stream.startTime)} ago</span>
              </>
            )}
          </div>
        </div>

        {stream.status === "live" && (
          <div className="stream-chat-section">
            <div className="stream-chat-title">Live Chat</div>
            {messages.length === 0 ? (
              <div className="stream-chat-empty">No messages yet</div>
            ) : (
              <div className="stream-chat" ref={chatRef}>
                {messages.map(msg => (
                  <div key={msg.id} className="stream-chat-msg">
                    <Avatar pk={msg.pubkey} profiles={profiles} size={20} />
                    <div className="stream-chat-msg-body">
                      <span className="stream-chat-name" onClick={() => onOpenProfile?.(msg.pubkey)} style={{ cursor: "pointer" }}>
                        {displayName(msg.pubkey, profiles)}
                      </span>
                      <span className="stream-chat-text">{msg.content}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    {jsonOpen && <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />}
    </>
  );
}
