import { useMemo } from "react";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import NoteActions from "./NoteActions.jsx";
import { Bk } from "./icons.jsx";
import { displayName, nip05OrNpub, relativeTime, fmtSatsVal, parseBolt11Msats } from "../utils.js";
import usePollData from "../hooks/usePollData.js";
import useProfiles from "../hooks/useProfiles.js";

function pct(count, total) { return total ? Math.round((count / total) * 100) : 0; }

export default function PollPage({
  event, profiles: propProfiles,
  myPubkey, myProfile,
  events = [],
  onBack, onOpenProfile, onOpenThread, onOpenHashtag,
  onOpenZaps, onOpenReactions, onOpenReposts,
  onPublish, publishEvent, onPrepend,
  onBookmark, isBookmarked,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  onRequestModal, onDismissModal,
  sendZap, defaultZapAmount = 21, defaultZapMsg = "", onZapFail,
  customEmojis,
}) {
  const isZapPoll = event.kind === 6969;
  const {
    options, voteCounts, myVote, total, isExpired, expiry,
    voteEvents, voterCount,
  } = usePollData({ event, myPubkey });

  // Build per-option voter lists
  const votersByOption = (() => {
    const map = {};
    for (const opt of options) map[opt.id] = [];

    if (isZapPoll) {
      for (const receipt of voteEvents) {
        const descTag = receipt.tags.find(t => t[0] === "description");
        if (!descTag) continue;
        let zapReq;
        try { zapReq = JSON.parse(descTag[1]); } catch { continue; }
        const optTag = (zapReq.tags || []).find(t => t[0] === "poll_option");
        if (!optTag || !map[optTag[1]]) continue;
        const bolt11 = receipt.tags.find(t => t[0] === "bolt11")?.[1];
        const msats = bolt11 ? parseBolt11Msats(bolt11) : 0;
        const sats = Math.round(msats / 1000);
        map[optTag[1]].push({ pubkey: zapReq.pubkey, amount: sats });
      }
    } else {
      // Deduplicate: one vote per pubkey (latest wins)
      const latestByPubkey = new Map();
      for (const ev of voteEvents) {
        const existing = latestByPubkey.get(ev.pubkey);
        if (!existing || ev.created_at > existing.created_at) latestByPubkey.set(ev.pubkey, ev);
      }
      for (const ev of latestByPubkey.values()) {
        const responses = ev.tags.filter(t => t[0] === "response" && t[1]);
        for (const r of responses) {
          if (map[r[1]]) map[r[1]].push({ pubkey: ev.pubkey });
        }
      }
    }
    return map;
  })();

  const voterPks = useMemo(() => {
    const pks = new Set([event.pubkey]);
    for (const ev of voteEvents) {
      if (isZapPoll) {
        const d = ev.tags.find(t => t[0] === "description");
        try { const pk = JSON.parse(d[1]).pubkey; if (pk) pks.add(pk); } catch {}
      } else {
        pks.add(ev.pubkey);
      }
    }
    return [...pks];
  }, [event.pubkey, voteEvents, isZapPoll]);
  const { profiles: localProfiles } = useProfiles({ pubkeys: voterPks });
  const profiles = useMemo(() => ({ ...propProfiles, ...localProfiles }), [propProfiles, localProfiles]);

  const expiryLabel = (() => {
    if (!expiry) return null;
    if (isExpired) return "Poll ended";
    const s = expiry - Math.floor(Date.now() / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
    return d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h left` : "Ending soon";
  })();

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <button className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
          {isZapPoll ? "⚡ Zap Poll" : "User Poll"}
        </span>
      </div>

      <div style={{ padding: "4px 16px 0" }}>
        <div className="note-header" style={{ marginBottom: 10 }}>
          <div onClick={() => onOpenProfile?.(event.pubkey)} style={{ cursor: "pointer", flexShrink: 0 }}>
            <Avatar pk={event.pubkey} profiles={profiles} size={36} />
          </div>
          <div className="note-meta">
            <span className="note-name" style={{ cursor: "pointer" }} onClick={() => onOpenProfile?.(event.pubkey)}>
              {displayName(event.pubkey, profiles)}
            </span>
            <span className="note-npub">{nip05OrNpub(event.pubkey, profiles)}</span>
            <span className="meta-dot" aria-hidden="true">·</span>
            <span className="note-time">{relativeTime(event.created_at)}</span>
          </div>
        </div>

        {event.content?.trim() ? (
          <NoteContent
            content={event.content}
            tags={event.tags}
            profiles={profiles}
            onOpenProfile={onOpenProfile}
            onOpenHashtag={onOpenHashtag}
            allowEmbeds={false}
            className="note-text"
          />
        ) : null}

        <div className="poll-options" style={{ marginTop: 8 }}>
          {options.map(opt => {
            const count = voteCounts[opt.id] ?? 0;
            const p = pct(count, total);
            const isChosen = myVote === opt.id;
            return (
              <div key={opt.id} className={`poll-result-row${isChosen ? " poll-chosen" : ""}`}>
                <div className="poll-bar-wrap"><div className="poll-bar-fill" style={{ "--pct": `${p}%` }} /></div>
                <div className="poll-result-label">
                  <span className="poll-opt-text">{opt.label}{isChosen ? " ✓" : ""}</span>
                  <span className="poll-opt-count">
                    {isZapPoll ? `${fmtSatsVal(count)} sats` : `${count} vote${count !== 1 ? "s" : ""}`} · {p}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="poll-footer" style={{ marginTop: 6 }}>
          <span>{voterCount} {isZapPoll ? "zap" : "vote"}{voterCount !== 1 ? "s" : ""}</span>
          {expiryLabel && <><span>·</span><span>{expiryLabel}</span></>}
        </div>

        <NoteActions
          event={event}
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
          sendZap={sendZap}
          defaultZapAmount={defaultZapAmount}
          defaultZapMsg={defaultZapMsg}
          onZapFail={onZapFail}
          customEmojis={customEmojis}
          onRequestModal={onRequestModal}
          onDismissModal={onDismissModal}
        />
      </div>

      {options.map(opt => {
        const voters = votersByOption[opt.id] ?? [];
        if (!voters.length) return null;
        return (
          <div key={opt.id}>
            <div className="zap-goal-contributors-head">
              <span>{opt.label}</span>
              <span className="zap-goal-contributors-count">{voters.length}</span>
            </div>
            {voters.map((v, i) => (
              <div key={`${v.pubkey}-${i}`} className="list-row" onClick={() => onOpenProfile?.(v.pubkey)}>
                <div className="list-row-av">
                  <Avatar pk={v.pubkey} profiles={profiles} size={36} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="list-row-name">{displayName(v.pubkey, profiles)}</div>
                </div>
                {isZapPoll && v.amount > 0 && (
                  <div className="list-row-right">{fmtSatsVal(v.amount)} sats</div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {voterCount === 0 && (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-title">No votes yet</div>
          <div className="empty-state-sub">Be the first to vote</div>
        </div>
      )}
    </div>
  );
}

