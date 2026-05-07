import { useState, useRef, useCallback } from "react";
import { Zi, Hi, Ri, Rpi, Bi } from "./icons.jsx";
import { haptic, fmtSatsVal, replyCount, repostAndQuoteCount } from "../utils.js";
import ZapBadges from "./ZapBadges.jsx";
import ZapModal from "./ZapModal.jsx";
import ZapAnimation from "./ZapAnimation.jsx";
import EmojiPickerSheet from "./EmojiPickerSheet.jsx";
import ComposeSheet from "./ComposeSheet.jsx";
import RepostSheet from "./RepostSheet.jsx";

export default function NoteActions({
  event, profiles, myPubkey, myProfile, events: allEvents,
  onOpenThread, onOpenZaps, onOpenReactions, onOpenReposts,
  onPublish, onBookmark, isBookmarked, publishEvent, onPrepend,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  onRequestModal, onDismissModal,
}) {
  const reactions    = getLocalReactions?.(event.id) ?? [];
  const rCount       = replyCount(event.id, allEvents);
  const localZaps    = getLocalZaps?.(event.id) ?? [];
  const myReaction   = reactions.find(r => (r.pk ?? r) === myPubkey);

  const [reaction,     setReaction]     = useState(myReaction?.emoji || null);
  const [showZapModal, setShowZapModal] = useState(false);
  const [localModal,   setLocalModal]   = useState(null);
  const zapBtnRef     = useRef(null);
  const zapAnimCoords = useRef(null);

  const dismiss   = () => { onDismissModal?.(); setLocalModal(null); };
  const openModal = node => {
    if (onRequestModal) onRequestModal(node);
    else setLocalModal(node);
  };

  const addZap = ({ amount, msg }) => {
    const newZap = { zapper: myPubkey, amount: amount * 1000, comment: msg || "" };
    addLocalZap?.(event.id, newZap);
  };

  const handleZapFromModal = ({ amount, msg }) => {
    setShowZapModal(false);
    if (zapBtnRef.current) {
      const r = zapBtnRef.current.getBoundingClientRect();
      zapAnimCoords.current = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }
    const coords = zapAnimCoords.current;
    if (coords) openModal(<ZapAnimation cx={coords.cx} cy={coords.cy} onDone={dismiss} />);
    setTimeout(() => addZap({ amount, msg }), 680);
  };

  const handleZapInstant = useCallback(() => {
    haptic.zap();
    const coords = zapBtnRef.current
      ? (() => { const r = zapBtnRef.current.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; })()
      : null;
    if (coords) openModal(<ZapAnimation cx={coords.cx} cy={coords.cy} onDone={dismiss} />);
    setTimeout(() => addZap({ amount: 21, msg: "" }), 680);
  }, [localZaps]);

  const handleReact = useCallback((emoji = "🧡") => {
    if (reaction) return;
    haptic.tap();
    setReaction(emoji);
    if (setLocalReaction) setLocalReaction(event.id, myPubkey, emoji);
  }, [reaction]);

  const handleReactPick = useCallback(emoji => {
    haptic.tap();
    setReaction(emoji);
    if (setLocalReaction) setLocalReaction(event.id, myPubkey, emoji);
  }, []);

  return (
    <>
      <div onClick={e => e.stopPropagation()}>
        <ZapBadges zaps={localZaps} eventId={event.id} profiles={profiles}
          onOpenZaps={() => onOpenZaps?.({ eventId: event.id, zaps: localZaps })} />
        <div className="note-actions" style={{ marginTop: 2 }}>
          <button ref={zapBtnRef} className="action-btn"
            onClick={e => { e.stopPropagation(); handleZapInstant(); }}
            onMouseDown={e => { e.stopPropagation(); const t = setTimeout(() => { haptic.longPress(); setShowZapModal(true); }, 600); window.addEventListener("mouseup", () => clearTimeout(t), { once: true }); }}
            onTouchStart={e => { e.stopPropagation(); const t = setTimeout(() => { haptic.longPress(); setShowZapModal(true); }, 600); window.addEventListener("touchend", () => clearTimeout(t), { once: true }); }}
          >
            <Zi />{localZaps.length ? fmtSatsVal(localZaps.reduce((s, z) => s + Math.round(z.amount / 1000), 0)) : ""}
          </button>
          <button className={`action-btn${reaction ? " reacted" : ""}`}
            style={reaction ? { color: "var(--primary)" } : {}}
            onClick={e => { e.stopPropagation(); handleReact(); }}
            onMouseDown={e => { e.stopPropagation(); const t = setTimeout(() => openModal(<EmojiPickerSheet onPick={emoji => { handleReactPick(emoji); dismiss(); }} onDismiss={dismiss} />), 600); window.addEventListener("mouseup", () => clearTimeout(t), { once: true }); }}
            onTouchStart={e => { e.stopPropagation(); const t = setTimeout(() => openModal(<EmojiPickerSheet onPick={emoji => { handleReactPick(emoji); dismiss(); }} onDismiss={dismiss} />), 600); window.addEventListener("touchend", () => clearTimeout(t), { once: true }); }}
          >
            {reaction && reaction !== "🧡"
              ? <span style={{ fontSize: 14, lineHeight: 1 }}>{reaction}</span>
              : <svg width={14} height={14} viewBox="0 0 24 24" fill={reaction ? "var(--primary)" : "none"} stroke={reaction ? "var(--primary)" : "currentColor"} strokeWidth={2}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            }
            {reactions.length || ""}
          </button>
          <button className="action-btn"
            onClick={e => { e.stopPropagation(); openModal(<ComposeSheet replyTo={event} profiles={profiles} myPubkey={myPubkey} myProfile={myProfile} events={allEvents} publishEvent={publishEvent} onPrepend={onPrepend} onDismiss={dismiss} />); }}>
            <Ri />{rCount || ""}
          </button>
          <button className="action-btn"
            onClick={e => { e.stopPropagation(); openModal(<RepostSheet event={event} profiles={profiles} publishEvent={publishEvent} onPrepend={onPrepend} onQuoteRepost={() => openModal(<ComposeSheet quotedEvent={event} profiles={profiles} myPubkey={myPubkey} myProfile={myProfile} events={allEvents} publishEvent={publishEvent} onPrepend={onPrepend} onDismiss={dismiss} />)} onDismiss={dismiss} />); }}>
            <Rpi />{repostAndQuoteCount(event.id, allEvents) || ""}
          </button>
          <button className={`action-btn${isBookmarked?.(event) ? " saved" : ""}`}
            onClick={e => { e.stopPropagation(); onBookmark?.(event); }}>
            <Bi f={!!isBookmarked?.(event)} />
          </button>
        </div>
      </div>
      {showZapModal && <ZapModal event={event} profiles={profiles} onZap={handleZapFromModal} onDismiss={() => setShowZapModal(false)} />}
      {localModal}
    </>
  );
}
