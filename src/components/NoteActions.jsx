import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Zi, Hi, Ri, Rpi, Bi } from "./icons.jsx";
import { haptic, fmtSatsVal, replyCount as computeReplyCount, repostAndQuoteCount as computeRepostCount, addressableCoordinate } from "../utils.js";
import { broadcastEvent } from "../nostr.js";
import ZapBadges from "./ZapBadges.jsx";
import ZapModal from "./ZapModal.jsx";
import ZapAnimation from "./ZapAnimation.jsx";
import EmojiPickerSheet from "./EmojiPickerSheet.jsx";
import ComposeSheet from "./ComposeSheet.jsx";
import RepostSheet from "./RepostSheet.jsx";

export default function NoteActions({
  event, profiles, myPubkey, myProfile, events: allEvents,
  replyCount: replyCountProp, repostCount: repostCountProp,
  onOpenThread, onOpenZaps, onOpenReactions, onOpenReposts,
  onPublish, onBookmark, isBookmarked, publishEvent, onPrepend,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction, getLocalReposts, getLocalReplies,
  onRequestModal, onDismissModal,
  sendZap, defaultZapAmount = 21, defaultZapMsg = "", onZapFail,
  customEmojis,
  additionalEventIds = [],
  addressableCoord,
}) {
  // "kind:pubkey:d" coordinate for addressable events (30023/30030/30311/…) so
  // reactions, zaps and reposts attach to the replaceable event, not just one
  // version's id. Auto-detected from the event; kind-1 notes resolve to null.
  const coord = addressableCoord ?? addressableCoordinate(event);
  const primaryReactions = getLocalReactions?.(event.id) ?? [];
  const reactions = additionalEventIds.length === 0 ? primaryReactions : (() => {
    const seen = new Set(primaryReactions.map(r => r.id).filter(Boolean));
    const extra = additionalEventIds.flatMap(id => (getLocalReactions?.(id) ?? []).filter(r => !r.id || !seen.has(r.id)));
    return [...primaryReactions, ...extra];
  })();
  const rCount = (replyCountProp ?? computeReplyCount(event.id, allEvents, getLocalReplies?.(event.id)))
    + (additionalEventIds.length ? additionalEventIds.reduce((s, id) => s + computeReplyCount(id, allEvents, getLocalReplies?.(id)), 0) : 0);
  const primaryZaps = getLocalZaps?.(event.id) ?? [];
  const localZaps = additionalEventIds.length === 0 ? primaryZaps : (() => {
    const seen = new Set(primaryZaps.map(z => z.id).filter(Boolean));
    const extra = additionalEventIds.flatMap(id => (getLocalZaps?.(id) ?? []).filter(z => !z.id || !seen.has(z.id)));
    return [...primaryZaps, ...extra].sort((a, b) => b.amount - a.amount);
  })();
  const myReaction   = reactions.find(r => (r.pk ?? r) === myPubkey);

  const [reaction,     setReaction]     = useState(myReaction?.emoji || null);

  // Resolve a custom emoji string like ":name:" to an image URL.
  // Checks the stored reaction's own tags first (relay-loaded events already carry the URL),
  // then falls back to the user's emoji list (picker-chosen reactions).
  const reactionEmojiUrl = (() => {
    if (!reaction) return null;
    const m = reaction.match(/^:([a-zA-Z0-9_-]+):$/);
    if (!m) return null;
    const name = m[1];
    const fromTags = myReaction?.tags?.find(t => t[0] === "emoji" && t[1] === name)?.[2];
    if (fromTags) return fromTags;
    return customEmojis?.find(e => e.name === name)?.url ?? null;
  })();
  const [showZapModal, setShowZapModal] = useState(false);
  const [localModal,   setLocalModal]   = useState(null);
  const zapBtnRef     = useRef(null);
  const reactBtnRef   = useRef(null);
  const zapAnimCoords = useRef(null);

  const recipientLnAddr = profiles[event.pubkey]?.lud16 || profiles[event.pubkey]?.lud06 || null;

  const dismiss   = () => { onDismissModal?.(); setLocalModal(null); };
  const openModal = node => {
    if (onRequestModal) onRequestModal(node);
    else setLocalModal(node);
  };

  const addZap = ({ amount, msg }) => {
    addLocalZap?.(event.id, { zapper: myPubkey, amount: amount * 1000, comment: msg || "" });
  };

  const doSendZap = useCallback(async ({ amount, msg }) => {
    if (!sendZap) { onZapFail?.("no_wallet"); return; }
    if (!recipientLnAddr) { onZapFail?.("no_lud16"); return; }
    const result = await sendZap({ amountSats: amount, recipientLnAddr, recipientPubkey: event.pubkey, eventId: event.id, eventKind: event.kind, aTag: coord, msg });
    if (!result.ok) onZapFail?.(result.reason);
  }, [sendZap, recipientLnAddr, event.pubkey, event.id, event.kind, coord, onZapFail]);

  const handleZapFromModal = ({ amount, msg }) => {
    setShowZapModal(false);
    if (zapBtnRef.current) {
      const r = zapBtnRef.current.getBoundingClientRect();
      zapAnimCoords.current = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }
    const coords = zapAnimCoords.current;
    if (coords) openModal(<ZapAnimation cx={coords.cx} cy={coords.cy} onDone={dismiss} />);
    setTimeout(() => { addZap({ amount, msg }); doSendZap({ amount, msg }); }, 680);
    if (event.pubkey !== myPubkey) broadcastEvent(event, { silent: true });
  };

  const handleZapInstant = useCallback(() => {
    haptic.zap();
    const coords = zapBtnRef.current
      ? (() => { const r = zapBtnRef.current.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; })()
      : null;
    if (coords) openModal(<ZapAnimation cx={coords.cx} cy={coords.cy} onDone={dismiss} />);
    setTimeout(() => { addZap({ amount: defaultZapAmount, msg: defaultZapMsg }); doSendZap({ amount: defaultZapAmount, msg: defaultZapMsg }); }, 680);
    if (event.pubkey !== myPubkey) broadcastEvent(event, { silent: true });
  }, [localZaps, defaultZapAmount, defaultZapMsg, doSendZap, event, myPubkey]);

  const publishReaction = useCallback((content, emojiTag) => {
    const tags = [["e", event.id], ["p", event.pubkey]];
    if (coord) { tags.push(["a", coord]); tags.push(["k", String(event.kind)]); }
    if (emojiTag) tags.push(emojiTag);
    publishEvent?.({ kind: 7, content, tags });
  }, [publishEvent, event.id, event.pubkey, event.kind, coord]);

  const handleReact = useCallback((emoji = "💜") => {
    if (reaction) return;
    haptic.tap();
    setReaction(emoji);
    if (setLocalReaction) setLocalReaction(event.id, myPubkey, emoji);
    publishReaction(emoji);
    if (event.pubkey !== myPubkey) broadcastEvent(event, { silent: true });
  }, [reaction, publishReaction, event, myPubkey]);

  const handleReactPick = useCallback(picked => {
    haptic.tap();
    const isCustom = picked && typeof picked === "object";
    const displayEmoji = isCustom ? picked.content : picked;
    const emojiTag    = isCustom ? picked.emojiTag  : null;
    setReaction(displayEmoji);
    if (setLocalReaction) setLocalReaction(event.id, myPubkey, displayEmoji, emojiTag ? { tags: [emojiTag] } : {});
    publishReaction(displayEmoji, emojiTag);
    if (event.pubkey !== myPubkey) broadcastEvent(event, { silent: true });
  }, [publishReaction, event, myPubkey]);

  return (
    <>
      <div onClick={e => e.stopPropagation()} style={{ marginTop: 8 }}>
        <ZapBadges zaps={localZaps} eventId={event.id} profiles={profiles}
          onOpenZaps={() => onOpenZaps?.({ eventId: event.id, zaps: localZaps })} />
        <div className="note-actions">
          <button ref={zapBtnRef} className="action-btn"
            onClick={e => { e.stopPropagation(); handleZapInstant(); }}
            onMouseDown={e => { e.stopPropagation(); const t = setTimeout(() => { haptic.longPress(); setShowZapModal(true); }, 600); window.addEventListener("mouseup", () => clearTimeout(t), { once: true }); }}
            onTouchStart={e => { e.stopPropagation(); const t = setTimeout(() => { haptic.longPress(); setShowZapModal(true); }, 600); window.addEventListener("touchend", () => clearTimeout(t), { once: true }); }}
          >
            <Zi />
            {localZaps.length ? fmtSatsVal(localZaps.reduce((s, z) => s + Math.round(z.amount / 1000), 0)) : ""}
          </button>
          <button ref={reactBtnRef} className={`action-btn${reaction ? " reacted" : ""}`}
            style={reaction ? { color: "var(--primary)" } : {}}
            onClick={e => { e.stopPropagation(); handleReact(); }}
            onMouseDown={e => { e.stopPropagation(); const t = setTimeout(() => { haptic.longPress(); const rect = reactBtnRef.current?.getBoundingClientRect(); openModal(<EmojiPickerSheet customEmojis={customEmojis} triggerRect={rect} onPick={emoji => { handleReactPick(emoji); dismiss(); }} onDismiss={dismiss} />); }, 600); window.addEventListener("mouseup", () => clearTimeout(t), { once: true }); }}
            onTouchStart={e => { e.stopPropagation(); const t = setTimeout(() => { haptic.longPress(); const rect = reactBtnRef.current?.getBoundingClientRect(); openModal(<EmojiPickerSheet customEmojis={customEmojis} triggerRect={rect} onPick={emoji => { handleReactPick(emoji); dismiss(); }} onDismiss={dismiss} />); }, 600); window.addEventListener("touchend", () => clearTimeout(t), { once: true }); }}
          >
            {reaction && reaction !== "💜"
              ? reactionEmojiUrl
                ? <img src={reactionEmojiUrl} alt={reaction} style={{ width: 16, height: 16, objectFit: "contain", verticalAlign: "middle", display: "inline-block" }} />
                : <span style={{ fontSize: 14, lineHeight: 1 }}>{reaction}</span>
              : <svg width={14} height={14} viewBox="0 0 24 24" fill={reaction ? "var(--primary)" : "none"} stroke={reaction ? "var(--primary)" : "currentColor"} strokeWidth={2}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            }
            {reactions.length || ""}
          </button>
          <button className="action-btn"
            onClick={e => { e.stopPropagation(); openModal(<ComposeSheet replyTo={event} profiles={profiles} myPubkey={myPubkey} myProfile={myProfile} events={allEvents} publishEvent={publishEvent} onPrepend={onPrepend} onDismiss={dismiss} customEmojis={customEmojis} />); }}>
            <Ri />{rCount || ""}
          </button>
          <button className="action-btn"
            onClick={e => { e.stopPropagation(); openModal(<RepostSheet event={event} profiles={profiles} publishEvent={publishEvent} onPrepend={onPrepend} onQuoteRepost={() => openModal(<ComposeSheet quotedEvent={event} profiles={profiles} myPubkey={myPubkey} myProfile={myProfile} events={allEvents} publishEvent={publishEvent} onPrepend={onPrepend} onDismiss={dismiss} customEmojis={customEmojis} />)} onDismiss={dismiss} />); }}
            onMouseDown={e => { e.stopPropagation(); const t = setTimeout(() => { haptic.longPress(); openModal(<ComposeSheet quotedEvent={event} profiles={profiles} myPubkey={myPubkey} myProfile={myProfile} events={allEvents} publishEvent={publishEvent} onPrepend={onPrepend} onDismiss={dismiss} customEmojis={customEmojis} />); }, 600); window.addEventListener("mouseup", () => clearTimeout(t), { once: true }); }}
            onTouchStart={e => { e.stopPropagation(); const t = setTimeout(() => { haptic.longPress(); openModal(<ComposeSheet quotedEvent={event} profiles={profiles} myPubkey={myPubkey} myProfile={myProfile} events={allEvents} publishEvent={publishEvent} onPrepend={onPrepend} onDismiss={dismiss} customEmojis={customEmojis} />); }, 600); window.addEventListener("touchend", () => clearTimeout(t), { once: true }); }}
          >
            <Rpi />{((repostCountProp ?? computeRepostCount(event.id, allEvents, getLocalReposts?.(event.id))) + additionalEventIds.reduce((s, id) => s + computeRepostCount(id, allEvents, getLocalReposts?.(id)), 0)) || ""}
          </button>
          <button className={`action-btn${isBookmarked?.(event) ? " saved" : ""}`}
            onClick={e => { e.stopPropagation(); onBookmark?.(event); }}>
            <Bi f={!!isBookmarked?.(event)} />
          </button>
        </div>
      </div>
      {showZapModal && createPortal(<ZapModal event={event} profiles={profiles} defaultAmount={defaultZapAmount} defaultMsg={defaultZapMsg} onZap={handleZapFromModal} onDismiss={() => setShowZapModal(false)} />, document.body)}
      {localModal && createPortal(localModal, document.body)}
    </>
  );
}
