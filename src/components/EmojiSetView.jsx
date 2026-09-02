import { useMemo, useState, useEffect } from "react";
import Avatar from "./Avatar.jsx";
import { Bk } from "./icons.jsx";
import NoteActions from "./NoteActions.jsx";
import FocusedStatsRow from "./FocusedStatsRow.jsx";
import {
  displayName, nip19, addressableCoordinate, replyCount as computeReplyCount,
  parseBolt11Msats, zapperPubkeyFromKind9735, zapCommentFromKind9735,
} from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";
import useProfiles from "../hooks/useProfiles.js";

const EMOJI_SET_KIND = 30030;
const PAGE = 60;

export function emojiSetInfo(event) {
  const dTag = event?.tags?.find(t => t[0] === "d")?.[1] ?? "";
  const title = event?.tags?.find(t => t[0] === "title")?.[1] || dTag || "Emoji set";
  const emojis = [...new Map(
    (event?.tags || [])
      .filter(t => t[0] === "emoji" && t[1] && t[2])
      .map(t => [t[1], { name: t[1], url: t[2] }])
  ).values()];
  const aTag = `${EMOJI_SET_KIND}:${event?.pubkey}:${dTag}`;
  return { dTag, title, emojis, aTag };
}

export function emojiSetNaddr(event) {
  const { dTag } = emojiSetInfo(event);
  try {
    return nip19.naddrEncode({ kind: EMOJI_SET_KIND, pubkey: event.pubkey, identifier: dTag, relays: [] });
  } catch { return null; }
}

// Scrollable emoji grid — sets can be large, so cap the height and page the DOM.
function EmojiGrid({ emojis, minCol = 56, maxHeight, pad = 0 }) {
  const [shown, setShown] = useState(Math.min(emojis.length, PAGE));
  useEffect(() => { setShown(Math.min(emojis.length, PAGE)); }, [emojis]);
  const onScroll = e => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) {
      setShown(n => Math.min(n + PAGE, emojis.length));
    }
  };
  return (
    <div
      onScroll={maxHeight ? onScroll : undefined}
      style={{
        marginTop: 6,
        ...(maxHeight ? { maxHeight, overflowY: "auto" } : {}),
        padding: pad,
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`,
        gap: 10,
      }}
    >
      {emojis.slice(0, shown).map(e => (
        <div key={e.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: "100%", aspectRatio: "1" }}>
            <img src={e.url} alt={e.name} title={`:${e.name}:`} loading="lazy" decoding="async" referrerPolicy="no-referrer"
              style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 6, border: "1px solid var(--border)", display: "block" }} />
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: "var(--text-muted)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", lineHeight: 1.3 }}>
            :{e.name}:
          </div>
        </div>
      ))}
    </div>
  );
}

// Card for feeds / embeds / thread rows. Previews a single row of emoji and opens
// the full set on click (a set can be large); pass `full` to render the entire
// grid inline, capped to a scrollable max height (used for the focused row in a
// set's own thread). Pass `hideHead` when the surrounding card already shows the author.
export function EmojiSetCard({ event, profiles, onOpenProfile, onOpen, hideHead = false, full = false }) {
  const { title, emojis } = emojiSetInfo(event);
  const shown = emojis.slice(0, 8);
  const extra = emojis.length - shown.length;
  return (
    <div
      className="note-embed"
      onClick={full ? undefined : e => { e.stopPropagation(); onOpen?.(event); }}
      role="presentation"
      style={full ? { cursor: "default" } : undefined}
    >
      <div className="note-embed-head">
        {!hideHead && (
          <>
            <div onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} role="presentation">
              <Avatar pk={event.pubkey} profiles={profiles} size={20} />
            </div>
            <span className="note-embed-name" onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} role="presentation">
              {displayName(event.pubkey, profiles)}
            </span>
          </>
        )}
        <span className="poll-badge" style={{ marginLeft: hideHead ? 0 : "auto" }}>
          Emoji set{full && emojis.length ? ` · ${emojis.length}` : ""}
        </span>
      </div>
      <div className="note-embed-text" style={{ fontWeight: 600, marginBottom: emojis.length ? 6 : 0 }}>{title}</div>
      {emojis.length > 0 && (full ? (
        <EmojiGrid emojis={emojis} maxHeight={320} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {shown.map(em => (
            <img key={em.name} src={em.url} alt={em.name} title={`:${em.name}:`} loading="lazy" decoding="async" referrerPolicy="no-referrer"
              style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0 }} />
          ))}
          {extra > 0 && (
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              +{extra} more
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// Populate the shared interaction ledger for an addressable event by its "a"
// coordinate (interactions from other clients aren't keyed by the version id).
function useSetInteractions({ coord, eventId, setLocalReaction, addLocalZap, addLocalRepost, addLocalReply }) {
  useEffect(() => {
    if (!coord || !eventId) return;
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
    const sub = pool.request(relayUrls, [
      { kinds: [7], "#a": [coord] },
      { kinds: [9735], "#a": [coord] },
      { kinds: [16], "#a": [coord] },
      { kinds: [1111, 1244], "#a": [coord] },
    ]).subscribe({
      next: raw => {
        if (raw.kind === 7 && raw.content) {
          setLocalReaction?.(eventId, raw.pubkey, raw.content === "+" ? "💜" : raw.content, { id: raw.id, tags: raw.tags });
        } else if (raw.kind === 9735) {
          const bolt11 = raw.tags.find(t => t[0] === "bolt11")?.[1];
          const msats = bolt11 ? parseBolt11Msats(bolt11) : 0;
          if (msats) addLocalZap?.(eventId, { id: raw.id, zapper: zapperPubkeyFromKind9735(raw) ?? raw.pubkey, amount: msats, comment: zapCommentFromKind9735(raw) ?? "" });
        } else if (raw.kind === 16) {
          eventStore.add(raw);
          addLocalRepost?.(eventId, { id: raw.id, pubkey: raw.pubkey, kind: raw.kind });
        } else if (raw.kind === 1111 || raw.kind === 1244) {
          eventStore.add(raw);
          addLocalReply?.(eventId, { id: raw.id });
        }
      },
    });
    return () => sub.unsubscribe();
  }, [coord, eventId, setLocalReaction, addLocalZap, addLocalRepost, addLocalReply]);
}

export default function EmojiSetView({
  event: passedEvent, profiles: propProfiles, onBack, onOpenProfile,
  mySets = [], onAddSet, onRemoveSet,
  myPubkey, myProfile, events = [], publishEvent, onPrepend, onPublish,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  getLocalReposts, addLocalRepost, getLocalReplies, addLocalReply,
  onRequestModal, onDismissModal, onOpenThread, onOpenZaps, onOpenReactions, onOpenReposts,
  sendZap, defaultZapAmount, defaultZapMsg, onZapFail, onBookmark, isBookmarked,
  customEmojis, showToast,
}) {
  const { profiles: localProfiles } = useProfiles({ pubkeys: passedEvent ? [passedEvent.pubkey] : [] });
  const profiles = useMemo(() => ({ ...propProfiles, ...localProfiles }), [propProfiles, localProfiles]);

  const coord = useMemo(() => addressableCoordinate(passedEvent), [passedEvent]);

  // Resolve the authoritative (latest) version so reactions attach to a real id.
  const [resolved, setResolved] = useState(passedEvent?.id ? passedEvent : null);
  useEffect(() => {
    setResolved(passedEvent?.id ? passedEvent : null);
    if (!coord) return;
    const [, cPubkey, dTag = ""] = coord.split(":");
    const filter = { kinds: [EMOJI_SET_KIND], authors: [cPubkey], "#d": [dTag], limit: 1 };
    const cached = eventStore.getTimeline([filter])?.[0];
    if (cached) setResolved(prev => (!prev || cached.created_at > prev.created_at ? cached : prev));
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;
    const sub = pool.request(relayUrls, [filter]).subscribe({
      next: ev => { eventStore.add(ev); setResolved(prev => (!prev || ev.created_at > prev.created_at ? ev : prev)); },
    });
    return () => sub.unsubscribe();
  }, [coord, passedEvent]);

  const event = resolved || passedEvent;
  const { title, emojis, aTag } = useMemo(() => emojiSetInfo(event), [event]);
  const alreadyAdded = mySets.some(s => s.aTag === aTag);
  const isMine = event?.pubkey === myPubkey;
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useSetInteractions({ coord, eventId: resolved?.id, setLocalReaction, addLocalZap, addLocalRepost, addLocalReply });

  const handleToggleSet = async () => {
    setSaving(true); setErr("");
    try {
      if (alreadyAdded) await onRemoveSet?.(aTag);
      else await onAddSet?.(event);
    } catch (e) { setErr(e?.message || "Could not save — check your signer"); }
    finally { setSaving(false); }
  };

  const handleShare = async () => {
    const naddr = emojiSetNaddr(event);
    const link = naddr ? `nostr:${naddr}` : null;
    if (!link) return;
    if (navigator.share) {
      try { await navigator.share({ title, text: link }); return; } catch { /* fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
      showToast?.("Set link copied");
    } catch { showToast?.("Could not copy link"); }
  };

  const zaps = getLocalZaps?.(resolved?.id) ?? [];
  const reactions = getLocalReactions?.(resolved?.id) ?? [];
  const localReposts = getLocalReposts?.(resolved?.id) ?? [];
  const rCount = resolved?.id ? computeReplyCount(resolved.id, events, getLocalReplies?.(resolved.id)) : 0;

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <button className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <div>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{title}</span>
          <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: 8 }}>
            {emojis.length} {emojis.length === 1 ? "emoji" : "emojis"}
          </span>
        </div>
      </div>

      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => onOpenProfile?.(event.pubkey)} role="presentation">
          <Avatar pk={event.pubkey} profiles={profiles} size={32} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-muted)" }}>
            by{" "}
            <span style={{ color: "var(--text)", fontWeight: 600, cursor: "pointer" }}
              onClick={() => onOpenProfile?.(event.pubkey)} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenProfile?.(event.pubkey); } }}>
              {displayName(event.pubkey, profiles)}
            </span>
          </div>
        </div>
        <button type="button" className="profile-follow-btn"
          onClick={handleShare}
          style={{ flexShrink: 0, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
          {copied ? "Copied" : "Share"}
        </button>
        {!isMine && (onAddSet || onRemoveSet) && (
          <button type="button"
            className="profile-follow-btn"
            disabled={saving}
            onClick={handleToggleSet}
            style={{ flexShrink: 0, ...(alreadyAdded ? { background: "none", border: "1px solid var(--border)", color: "var(--text-muted)" } : {}) }}>
            {saving ? "…" : alreadyAdded ? "Remove" : "Add set"}
          </button>
        )}
      </div>

      {err && (
        <div style={{ padding: "8px 16px", fontSize: 12, color: "#E05C8A", fontFamily: "'DM Sans',sans-serif" }}>{err}</div>
      )}

      {resolved?.id && publishEvent && (
        <div style={{ padding: "4px 16px 8px", borderBottom: "1px solid var(--border)" }}>
          <FocusedStatsRow
            eventId={resolved.id}
            allEvents={events}
            rCount={rCount}
            zaps={zaps}
            reactions={reactions}
            localReposts={localReposts}
            onOpenZaps={onOpenZaps}
            onOpenReactions={onOpenReactions}
            onOpenReposts={onOpenReposts}
          />
          <NoteActions
            event={resolved}
            profiles={profiles}
            myPubkey={myPubkey}
            myProfile={myProfile}
            events={events}
            onOpenThread={onOpenThread}
            onOpenZaps={onOpenZaps}
            onOpenReactions={onOpenReactions}
            onOpenReposts={onOpenReposts}
            onPublish={onPublish}
            publishEvent={publishEvent}
            onPrepend={onPrepend}
            onBookmark={onBookmark}
            isBookmarked={isBookmarked}
            getLocalZaps={getLocalZaps}
            addLocalZap={addLocalZap}
            getLocalReactions={getLocalReactions}
            setLocalReaction={setLocalReaction}
            getLocalReposts={getLocalReposts}
            getLocalReplies={getLocalReplies}
            onRequestModal={onRequestModal}
            onDismissModal={onDismissModal}
            sendZap={sendZap}
            defaultZapAmount={defaultZapAmount}
            defaultZapMsg={defaultZapMsg}
            onZapFail={onZapFail}
            customEmojis={customEmojis}
          />
        </div>
      )}

      {emojis.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No emojis</div>
          <div className="empty-state-sub">This set doesn&apos;t list any emoji</div>
        </div>
      ) : (
        <EmojiGrid emojis={emojis} minCol={64} pad="14px 16px 40px" />
      )}
    </div>
  );
}
