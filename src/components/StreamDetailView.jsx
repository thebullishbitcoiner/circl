import { useState, useEffect, useRef } from "react";
import Avatar from "./Avatar.jsx";
import { Bk } from "./icons.jsx";
import { displayName, nip05OrNpub, relativeTime, parseStreamEvent } from "../utils.js";
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
  const [progress, setProgress] = useState(0);
  const stream = parseStreamEvent(event);
  const { messages } = useStreamChat(event);
  const chatRef = useRef(null);

  const hostPk = stream.host?.pubkey ?? event.pubkey;

  // Fetch host profile if not already loaded
  useEffect(() => {
    if (!hostPk) return;
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    pool.request(relayUrls, [{ kinds: [0], authors: [hostPk] }]).subscribe({
      next: ev => eventStore.add(ev),
    });
  }, [hostPk]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fn = () => setProgress(Math.min((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100 || 0, 100));
    el.addEventListener("scroll", fn);
    return () => el.removeEventListener("scroll", fn);
  }, []);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div ref={ref} className="slide-panel-scroll">
      <div className="read-progress" style={{ width: `${progress}%` }} />
      <div className="panel-bar">
        <button className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span className="panel-bar-logo">Circl</span>
        <div style={{ display: "flex", gap: 3 }} />
      </div>

      {stream.streamingURLs.length > 0 ? (
        <StreamPlayer urls={stream.streamingURLs} />
      ) : stream.image ? (
        <div className="reader-hero">
          <img className="reader-hero-image" src={stream.image} alt={stream.title} loading="eager" decoding="async" referrerPolicy="no-referrer" />
        </div>
      ) : null}

      <div className="reader-content">
        <div className="reader-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <StatusBadge status={stream.status} />
            {stream.status === "live" && stream.viewers != null && (
              <span className="stream-viewer-count">{stream.viewers} watching</span>
            )}
          </div>

          <div className="reader-title">{stream.title || "Untitled Stream"}</div>
          {stream.summary && <div className="reader-summary">{stream.summary}</div>}

          {stream.hashtags?.length ? (
            <div className="reader-hashtags">
              {stream.hashtags.map(t => <span key={t}>#{t}</span>)}
            </div>
          ) : null}

          <div className="reader-meta">
            <div className="r-author-row" onClick={() => onOpenProfile?.(hostPk)} style={{ cursor: "pointer" }}>
              <div className="r-av"><Avatar pk={hostPk} profiles={profiles} size={34} /></div>
              <div>
                <div className="r-author-name">{displayName(hostPk, profiles)}</div>
                <div className="r-author-npub">{nip05OrNpub(hostPk, profiles)}</div>
              </div>
            </div>
            <div className="meta-sep" />
            <span className="meta-pill">{relativeTime(event.created_at)} ago</span>
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
  );
}
