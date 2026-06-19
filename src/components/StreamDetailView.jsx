import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar.jsx";
import { Bk, Zi } from "./icons.jsx";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import ZapModal from "./ZapModal.jsx";
import ZapAnimation from "./ZapAnimation.jsx";
import { displayName, relativeTime, parseStreamEvent, fmtSats, fmtSatsVal, parseBolt11Msats, zapCommentFromKind9735, zapperPubkeyFromKind9735, nip19 } from "../utils.js";
import useStreamChat from "../hooks/useStreamChat.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";

const MEDALS = ["🥇", "🥈", "🥉"];

function StreamZapLeaderboard({ zaps, profiles, onOpenProfile, onClose }) {
  const byZapper = new Map();
  for (const z of zaps) {
    byZapper.set(z.zapper, (byZapper.get(z.zapper) ?? 0) + Math.round(z.amount / 1000));
  }
  const ranked = [...byZapper.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 21);

  return (
    <div className="zap-leaderboard-sheet" onClick={e => e.stopPropagation()}>
      <div className="action-sheet-handle" />
      <div className="zap-leaderboard-title">Top Zappers</div>
      <div className="zap-leaderboard-list">
        {ranked.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 14, textAlign: "center", padding: "32px 0" }}>No zaps yet</div>}
        {ranked.map(([pk, total], i) => (
          <div key={pk} className="zap-leader-row" onClick={() => onOpenProfile?.(pk)}>
            <span className="zap-leader-rank">{i < 3 ? MEDALS[i] : `#${i + 1}`}</span>
            <Avatar pk={pk} profiles={profiles} size={36} />
            <div className="zap-leader-name">{displayName(pk, profiles)}</div>
            <div className="zap-leader-amt">⚡ {fmtSatsVal(total)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

export default function StreamDetailView({
  event, profiles, pubkey, myPubkey, onBack, onOpenProfile,
  sendZap, defaultZapAmount = 21, defaultZapMsg = "", onZapFail,
  getLocalZaps, addLocalZap, onRequestModal, onDismissModal, publishEvent,
}) {
  const ref = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [showZapModal, setShowZapModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const zapBtnRef = useRef(null);
  const stream = parseStreamEvent(event);
  const { messages, addMessage } = useStreamChat(event);
  const chatRef = useRef(null);

  const hostPks = (() => {
    const tagged = event.tags.filter(t => t[0] === "p" && t[3]?.toLowerCase() === "host").map(t => t[1]);
    return tagged.length > 0 ? tagged : [stream.host?.pubkey ?? event.pubkey];
  })();

  const recipientLnAddr = profiles[hostPks[0]]?.lud16 || profiles[hostPks[0]]?.lud06 || null;

  const relayZaps = messages
    .filter(m => m.kind === 9735)
    .map(m => ({
      zapper:  zapperPubkeyFromKind9735(m) ?? m.tags?.find(t => t[0] === "P")?.[1] ?? m.pubkey,
      amount:  parseBolt11Msats(m.tags?.find(t => t[0] === "bolt11")?.[1]) ?? 0,
      comment: zapCommentFromKind9735(m) ?? "",
    }));
  const localZaps = getLocalZaps?.(event.id) ?? [];
  const allZaps = [...relayZaps, ...localZaps];

  const dismiss = useCallback(() => { onDismissModal?.(); }, [onDismissModal]);

  const streamRelays = event.tags
    .filter(t => t[0] === "relays")
    .flatMap(t => t.slice(1))
    .filter(Boolean);
  const streamATag = `30311:${event.pubkey}:${stream.d ?? ""}`;

  const doSendZap = useCallback(async ({ amount, msg }) => {
    if (!sendZap) { onZapFail?.("no_wallet"); return; }
    if (!recipientLnAddr) { onZapFail?.("no_lud16"); return; }
    const result = await sendZap({ amountSats: amount, recipientLnAddr, recipientPubkey: event.pubkey, aTag: streamATag, extraRelays: streamRelays, msg });
    if (!result.ok) onZapFail?.(result.reason);
  }, [sendZap, recipientLnAddr, event.pubkey, streamATag, streamRelays, onZapFail]);

  const handleZapFromModal = useCallback(({ amount, msg }) => {
    setShowZapModal(false);
    const coords = zapBtnRef.current
      ? (() => { const r = zapBtnRef.current.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; })()
      : null;
    if (coords) onRequestModal?.(<ZapAnimation cx={coords.cx} cy={coords.cy} onDone={dismiss} />);
    setTimeout(() => {
      addLocalZap?.(event.id, { zapper: myPubkey, amount: amount * 1000, comment: msg || "" });
      doSendZap({ amount, msg });
    }, 680);
  }, [doSendZap, addLocalZap, event.id, myPubkey, onRequestModal, dismiss]);

  const handleSendComment = useCallback(async () => {
    const text = commentText.trim();
    if (!text || sendingComment || !publishEvent) return;
    setSendingComment(true);
    try {
      const relayHint = streamRelays[0] ?? "";
      const signed = await publishEvent({ kind: 1311, content: text, tags: [["a", streamATag, relayHint, "root"]] });
      if (signed) {
        // Also publish directly to the stream's relay (user's outbox may not include it)
        if (streamRelays.length) pool.publish(streamRelays, signed);
        addMessage(signed);
      }
      setCommentText("");
    } catch (err) {
      console.error("chat send failed:", err);
    } finally {
      setSendingComment(false);
    }
  }, [commentText, sendingComment, publishEvent, streamATag, streamRelays, addMessage]);

  // Fetch all host profiles
  useEffect(() => {
    if (!hostPks.length) return;
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    pool.request(relayUrls, [{ kinds: [0], authors: hostPks }]).subscribe({
      next: ev => eventStore.add(ev),
    });
  }, [hostPks.join(",")]);

  // Fetch profiles for all chat participants (authors, zappers, npub mentions)
  const _fetchedChatPks = useRef(new Set());
  useEffect(() => {
    if (!messages.length) return;
    const needed = new Set();
    for (const m of messages) {
      needed.add(m.pubkey);
      if (m.kind === 9735) {
        const zk = zapperPubkeyFromKind9735(m) ?? m.tags?.find(t => t[0] === "P")?.[1];
        if (zk) needed.add(zk);
      }
      if (m.content) {
        for (const match of m.content.matchAll(/nostr:(?:npub1|nprofile1)[023456789acdefghjklmnpqrstuvwxyz]+/ig)) {
          try {
            const d = nip19.decode(match[0].slice(6));
            const pk = d?.type === "npub" ? d.data : d?.type === "nprofile" ? d.data?.pubkey : null;
            if (pk) needed.add(pk);
          } catch {}
        }
      }
    }
    const toFetch = [...needed].filter(pk => !_fetchedChatPks.current.has(pk));
    if (!toFetch.length) return;
    toFetch.forEach(pk => _fetchedChatPks.current.add(pk));
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    pool.request(relayUrls, [{ kinds: [0], authors: toFetch }]).subscribe({
      next: ev => eventStore.add(ev),
    });
  }, [messages.length]);

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

        <div className="stream-zap-section">
          <div className="stream-zap-header">
            <button
              type="button"
              className="stream-zap-leaders-btn"
              onClick={() => setShowLeaderboard(true)}
              disabled={allZaps.length === 0}
            >
              ⚡ {allZaps.length > 0 ? `${fmtSatsVal(allZaps.reduce((s, z) => s + Math.round(z.amount / 1000), 0))} · Top Zappers` : "Top Zappers"}
            </button>
            <button ref={zapBtnRef} type="button" className="stream-zap-btn" onClick={() => setShowZapModal(true)}>
              <Zi /> Zap
            </button>
          </div>
        </div>

        {stream.status === "live" && (
          <div className="stream-chat-section">
            <div className="stream-chat-title">Live Chat</div>
            {messages.length === 0 ? (
              <div className="stream-chat-empty">No messages yet</div>
            ) : (
              <div className="stream-chat" ref={chatRef}>
                {messages.map(msg => {
                  if (msg.kind === 9735) {
                    const zapperPk = zapperPubkeyFromKind9735(msg) ?? msg.tags?.find(t => t[0] === "P")?.[1];
                    const msats = parseBolt11Msats(msg.tags?.find(t => t[0] === "bolt11")?.[1]);
                    const comment = zapCommentFromKind9735(msg);
                    return (
                      <div key={msg.id} className="stream-zap-msg">
                        <div className="stream-zap-badge">⚡ {fmtSats(msats)}</div>
                        <div className="stream-zap-body">
                          <span className="stream-chat-name" style={{ cursor: zapperPk ? "pointer" : "default" }} onClick={() => zapperPk && onOpenProfile?.(zapperPk)}>
                            {displayName(zapperPk ?? msg.pubkey, profiles)}
                          </span>
                          {comment && <span className="stream-zap-comment">"{comment}"</span>}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className="stream-chat-msg">
                      <Avatar pk={msg.pubkey} profiles={profiles} size={20} />
                      <div className="stream-chat-msg-body">
                        <span className="stream-chat-name" onClick={() => onOpenProfile?.(msg.pubkey)} style={{ cursor: "pointer" }}>
                          {displayName(msg.pubkey, profiles)}
                        </span>
                        <span className="stream-chat-text">{msg.content}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {myPubkey && (
              <div className="stream-chat-compose">
                <input
                  className="stream-chat-compose-input"
                  placeholder="Say something..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                  disabled={sendingComment}
                />
                <button
                  type="button"
                  className="stream-chat-compose-btn"
                  onClick={handleSendComment}
                  disabled={!commentText.trim() || sendingComment}
                >
                  Send
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    {jsonOpen && <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />}
    {showZapModal && createPortal(<ZapModal event={event} profiles={profiles} defaultAmount={defaultZapAmount} defaultMsg={defaultZapMsg} onZap={handleZapFromModal} onDismiss={() => setShowZapModal(false)} />, document.body)}
    {showLeaderboard && createPortal(
      <div className="overlay" onClick={() => setShowLeaderboard(false)}>
        <StreamZapLeaderboard
          zaps={allZaps}
          profiles={profiles}
          onOpenProfile={pk => { setShowLeaderboard(false); onOpenProfile?.(pk); }}
          onClose={() => setShowLeaderboard(false)}
        />
      </div>,
      document.body
    )}
    </>
  );
}
