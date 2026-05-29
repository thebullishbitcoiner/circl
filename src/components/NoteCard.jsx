import { useState, useRef, useCallback } from "react";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import ZapBadges from "./ZapBadges.jsx";
import ZapModal from "./ZapModal.jsx";
import ZapAnimation from "./ZapAnimation.jsx";
import EmojiPickerSheet from "./EmojiPickerSheet.jsx";
import ComposeSheet from "./ComposeSheet.jsx";
import RepostSheet from "./RepostSheet.jsx";
import { Zi, Hi, Ri, Rpi, Bi } from "./icons.jsx";
import { displayName, nip05OrNpub, relativeTime, haptic, fmtSatsVal, replyCount, repostAndQuoteCount } from "../utils.js";

export default function NoteCard({
  event, profiles, liked, bookmarked, likeCount,
  replyCount: rCount = 0, repostCount: rpCount = 0,
  myPubkey, myProfile, onLike, onBookmark,
  onOpenProfile, onOpenThread, onOpenHashtag, onOpenZaps, onOpenReactions, onOpenReposts,
  events = [],
  resolveEventById,
  onPublish, publishEvent, onPrepend,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  delay,
  replyingToPubkey = null,
  sendZap, defaultZapAmount = 21, defaultZapMsg = "", onZapFail,
}) {
  const reactions  = getLocalReactions?.(event.id) ?? [];
  const localZaps  = getLocalZaps?.(event.id) ?? [];
  const myReaction = reactions.find(r => (r.pk ?? r) === myPubkey);

  const [reaction, setReaction] = useState(myReaction?.emoji || null);
  const [modal,    setModal]    = useState(null);
  const [zapAnim,  setZapAnim]  = useState(null);
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const zapAnimCoords = useRef(null);
  const zapBtnRef     = useRef(null);

  const dismiss = () => setModal(null);

  const recipientLud16 = profiles[event.pubkey]?.lud16 ?? null;

  const addZap = ({ amount, msg }) => {
    const newZap = { zapper: myPubkey, amount: amount * 1000, comment: msg || "" };
    addLocalZap?.(event.id, newZap);
  };

  const doSendZap = useCallback(async ({ amount, msg }) => {
    console.warn("[zap] doSendZap", { amount, sendZap: !!sendZap, recipientLud16 });
    if (!sendZap) { console.log("[zap] no sendZap fn"); return; }
    if (!recipientLud16) { console.log("[zap] no lud16 for", event.pubkey); return; }
    const result = await sendZap({ amountSats: amount, recipientLud16, recipientPubkey: event.pubkey, eventId: event.id });
    console.log("[zap] result:", result);
    if (!result.ok) onZapFail?.(result.reason);
  }, [sendZap, recipientLud16, event.pubkey, event.id, onZapFail]);

  const publishReaction = useCallback(emoji => {
    publishEvent?.({ kind: 7, content: emoji, tags: [["e", event.id], ["p", event.pubkey]] });
  }, [publishEvent, event.id, event.pubkey]);

  const handleReact = useCallback((emoji = "🧡") => {
    if (reaction) return;
    haptic.tap();
    setReaction(emoji);
    if (setLocalReaction) setLocalReaction(event.id, myPubkey, emoji);
    publishReaction(emoji);
  }, [reaction, publishReaction]);

  const handleReactPick = useCallback(emoji => {
    haptic.tap();
    setReaction(emoji);
    if (setLocalReaction) setLocalReaction(event.id, myPubkey, emoji);
    publishReaction(emoji);
  }, [publishReaction]);

  const handleZapInstant = useCallback(() => {
    console.log("[zap] handleZapInstant fired", { defaultZapAmount, defaultZapMsg });
    haptic.zap();
    if (zapBtnRef.current) {
      const r = zapBtnRef.current.getBoundingClientRect();
      zapAnimCoords.current = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }
    setZapAnim(Date.now());
    setTimeout(() => {
      console.log("[zap] setTimeout fired");
      addZap({ amount: defaultZapAmount, msg: defaultZapMsg });
      doSendZap({ amount: defaultZapAmount, msg: defaultZapMsg });
    }, 680);
  }, [localZaps, defaultZapAmount, defaultZapMsg, doSendZap]);

  const copyToClipboard = useCallback(text => {
    navigator.clipboard?.writeText(text).catch(() => {});
  }, []);

  const copyNoteText = useCallback(() => {
    copyToClipboard(event.content || "");
    setCardMenuOpen(false);
  }, [event.content]);

  const copyNoteId = useCallback(() => {
    copyToClipboard(event.id || "");
    setCardMenuOpen(false);
  }, [event.id]);

  const copyJson = useCallback(() => {
    copyToClipboard(JSON.stringify(event, null, 2));
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 1200);
  }, [event]);

  return (
    <>
      <div
        className="note-card"
        style={{ animationDelay: `${delay}s` }}
        onClick={() => onOpenThread?.(event)}
      >
        <div className="note-inner">
          <div onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} style={{ cursor: "pointer", flexShrink: 0 }}>
            <Avatar pk={event.pubkey} profiles={profiles} size={36} />
          </div>
          <div className="note-body">
            <button
              type="button"
              className="note-card-menu-btn"
              onClick={e => { e.stopPropagation(); setCardMenuOpen(v => !v); }}
              aria-label="More options"
            >
              <span />
              <span />
              <span />
            </button>
            {cardMenuOpen && (
              <div className="note-card-menu" onClick={e => e.stopPropagation()}>
                <button className="note-card-menu-item" onClick={copyNoteText}>Copy Note Text</button>
                <button className="note-card-menu-item" onClick={copyNoteId}>Copy Note ID</button>
                <button className="note-card-menu-item" onClick={() => { setCardMenuOpen(false); setJsonOpen(true); }}>View JSON</button>
              </div>
            )}
            <div className="note-meta">
              <span className="note-name" style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
                {displayName(event.pubkey, profiles)}
              </span>
              <span className="note-npub">{nip05OrNpub(event.pubkey, profiles)}</span>
              <span className="meta-dot" aria-hidden="true">·</span>
              <span className="note-time">{relativeTime(event.created_at)}</span>
            </div>
            {replyingToPubkey && (
              <div
                className="ix-direction"
                style={{ marginBottom: 6, cursor: "pointer" }}
                onClick={e => { e.stopPropagation(); onOpenProfile?.(replyingToPubkey); }}
              >
                <span className="ix-dir-arrow">↩</span>
                replying to <span className="ix-mention" style={{ marginLeft: 3 }}>@{displayName(replyingToPubkey, profiles)}</span>
              </div>
            )}
            <NoteContent
              content={event.content}
              profiles={profiles}
              onOpenProfile={onOpenProfile}
              onOpenHashtag={onOpenHashtag}
              allEvents={events}
              onOpenThread={onOpenThread}
              resolveEventById={resolveEventById}
              collapsible
            />
            <ZapBadges zaps={localZaps} eventId={event.id} profiles={profiles} onOpenProfile={onOpenProfile}
              onOpenZaps={() => onOpenZaps?.({ eventId: event.id, zaps: localZaps })} />
            <div className="note-actions" onClick={e => e.stopPropagation()}>
              <button ref={zapBtnRef} className="action-btn"
                onClick={e => { e.stopPropagation(); console.warn("[zap] button clicked"); handleZapInstant(); }}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setModal("zap"); }}
                onMouseDown={e => { e.stopPropagation(); const t = setTimeout(() => setModal("zap"), 600); window.addEventListener("mouseup", () => clearTimeout(t), { once: true }); }}
                onTouchStart={e => { e.stopPropagation(); const t = setTimeout(() => setModal("zap"), 600); window.addEventListener("touchend", () => clearTimeout(t), { once: true }); }}
              >
                <Zi />{localZaps.length ? fmtSatsVal(localZaps.reduce((s, z) => s + Math.round(z.amount / 1000), 0)) : ""}
              </button>
              <button
                className={`action-btn${reaction ? " reacted" : ""}`}
                style={reaction ? { color: "var(--primary)" } : {}}
                onClick={e => { e.stopPropagation(); handleReact(); }}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setModal("emoji"); }}
                onMouseDown={e => {
                  e.stopPropagation();
                  const t = setTimeout(() => { haptic.longPress(); setModal("emoji"); }, 600);
                  const up = () => { clearTimeout(t); window.removeEventListener("mouseup", up); };
                  window.addEventListener("mouseup", up);
                }}
                onTouchStart={e => {
                  e.stopPropagation();
                  const t = setTimeout(() => { haptic.longPress(); setModal("emoji"); }, 600);
                  const end = () => { clearTimeout(t); window.removeEventListener("touchend", end); };
                  window.addEventListener("touchend", end, { once: true });
                }}
              >
                {reaction && reaction !== "🧡"
                  ? <span style={{ fontSize: 14, lineHeight: 1 }}>{reaction}</span>
                  : <svg width={14} height={14} viewBox="0 0 24 24" fill={reaction ? "var(--primary)" : "none"} stroke={reaction ? "var(--primary)" : "currentColor"} strokeWidth={2}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                }
                {reactions.length || ""}
              </button>
              <button className="action-btn" onClick={() => setModal("compose")}><Ri />{rCount || ""}</button>
              <button className="action-btn" onClick={() => setModal("repost")}><Rpi />{rpCount || ""}</button>
              <button className={`action-btn${bookmarked ? " saved" : ""}`} onClick={() => onBookmark(event)}><Bi f={bookmarked} /></button>
            </div>
          </div>
        </div>
      </div>

      {modal === "compose" && <ComposeSheet replyTo={event} profiles={profiles} myPubkey={myPubkey} myProfile={myProfile} events={events} onPost={onPublish} publishEvent={publishEvent} onPrepend={onPrepend} onDismiss={dismiss} />}
      {modal === "repost"  && <RepostSheet event={event} profiles={profiles} publishEvent={publishEvent} onPrepend={onPrepend} onQuoteRepost={() => setModal("quote")} onDismiss={dismiss} />}
      {modal === "quote"   && <ComposeSheet quotedEvent={event} profiles={profiles} myPubkey={myPubkey} myProfile={myProfile} events={events} onPost={onPublish} publishEvent={publishEvent} onPrepend={onPrepend} onDismiss={dismiss} />}
      {modal === "emoji"   && <EmojiPickerSheet onPick={emoji => { handleReactPick(emoji); dismiss(); }} onDismiss={dismiss} />}
      {modal === "zap"     && (
        <ZapModal event={event} profiles={profiles}
          defaultAmount={defaultZapAmount} defaultMsg={defaultZapMsg}
          onZap={({ amount, msg }) => {
            if (zapBtnRef.current) {
              const r = zapBtnRef.current.getBoundingClientRect();
              zapAnimCoords.current = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
            }
            setZapAnim(Date.now());
            setTimeout(() => {
              addZap({ amount, msg });
              doSendZap({ amount, msg });
            }, 680);
          }}
          onDismiss={dismiss} />
      )}
      {zapAnim && zapAnimCoords.current && (
        <ZapAnimation cx={zapAnimCoords.current.cx} cy={zapAnimCoords.current.cy} onDone={() => setZapAnim(null)} />
      )}
      {jsonOpen && (
        <div className="overlay centered" onClick={() => setJsonOpen(false)}>
          <div className="note-json-modal" onClick={e => e.stopPropagation()}>
            <div className="note-json-header">
              <div className="note-json-title">Event JSON</div>
              <button type="button" className="note-json-close" onClick={() => setJsonOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="note-json-pre-wrap">
              <button type="button" className="note-json-copy" onClick={e => { e.stopPropagation(); copyJson(); }} aria-label="Copy JSON">
                {jsonCopied ? "✓" : "⧉"}
              </button>
              <pre className="note-json-pre">{JSON.stringify(event, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
