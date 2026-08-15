import { useState, memo } from "react";
import { useNavigation } from "../context/NavigationContext.jsx";
import { createPortal } from "react-dom";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import NoteActions from "./NoteActions.jsx";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import ZapModal from "./ZapModal.jsx";
import ZapAnimation from "./ZapAnimation.jsx";
import { displayName, nip05OrNpub, relativeTime, fmtSatsVal } from "../utils.js";
import usePollData from "../hooks/usePollData.js";

function pct(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

function ExpiryLine({ expiry, isExpired }) {
  if (!expiry) return null;
  if (isExpired) return <div className="poll-expiry">Poll ended</div>;
  const secs = expiry - Math.floor(Date.now() / 1000);
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const label = days > 0 ? `${days}d ${hours}h left` : hours > 0 ? `${hours}h left` : "Ending soon";
  return <div className="poll-expiry">{label}</div>;
}

function PollCard({
  event, profiles,
  myPubkey, myProfile,
  events = [],
  resolveEventById,
  onOpenProfile, onOpenThread, onOpenHashtag, onOpenZaps, onOpenReactions, onOpenReposts,
  onPublish, publishEvent, onPrepend,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  sendZap, defaultZapAmount = 21, defaultZapMsg = "", onZapFail,
  onRequestModal, onDismissModal,
  onOpenVotes,
  customEmojis,
  delay = 0,
}) {
  const { onOpenPoll } = useNavigation();
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  if (deleted) return null;
  const [localModal, setLocalModal] = useState(null);
  const [zapTargetOption, setZapTargetOption] = useState(null);
  const [showZapModal, setShowZapModal] = useState(false);
  const [localVote, setLocalVote] = useState(null);
  const [localVoteCounts, setLocalVoteCounts] = useState(null);
  const [viewResults, setViewResults] = useState(false);

  const { options, voteCounts, myVote, total, isExpired, expiry, loading, polltype, zapLimits, voteEvents, voterCount } = usePollData({ event, myPubkey });
  const isZapPoll = event.kind === 6969;
  const effectiveVote = localVote ?? myVote;
  const effectiveCounts = localVoteCounts ?? voteCounts;
  const effectiveTotal = localVoteCounts
    ? Object.values(localVoteCounts).reduce((s, v) => s + v, 0)
    : total;
  const hasVoted = !!effectiveVote;
  const showResults = hasVoted || isExpired || viewResults;

  const recipientLnAddr = profiles[event.pubkey]?.lud16 || profiles[event.pubkey]?.lud06 || null;

  const dismiss = () => { onDismissModal?.(); setLocalModal(null); };
  const openModal = node => {
    if (onRequestModal) onRequestModal(node);
    else setLocalModal(node);
  };

  const handleStandardVote = optId => {
    if (hasVoted || isExpired) return;
    setLocalVote(optId);
    setLocalVoteCounts(prev => {
      const base = prev ?? voteCounts;
      return { ...base, [optId]: (base[optId] ?? 0) + 1 };
    });
    publishEvent?.({
      kind: 1018,
      content: "",
      tags: [["e", event.id], ["p", event.pubkey], ["response", optId]],
    });
  };

  const handleZapVoteFromModal = ({ amount, msg }) => {
    setShowZapModal(false);
    const optId = zapTargetOption;
    setZapTargetOption(null);
    if (!optId) return;

    setLocalVote(optId);
    setLocalVoteCounts(prev => {
      const base = prev ?? voteCounts;
      return { ...base, [optId]: (base[optId] ?? 0) + amount };
    });

    const doZap = async () => {
      if (!sendZap) { onZapFail?.("no_wallet"); return; }
      if (!recipientLnAddr) { onZapFail?.("no_lud16"); return; }
      const result = await sendZap({
        amountSats: amount, recipientLnAddr, recipientPubkey: event.pubkey,
        eventId: event.id, eventKind: event.kind, msg, pollOption: optId,
      });
      if (!result.ok) onZapFail?.(result.reason);
    };

    openModal(<ZapAnimation cx={window.innerWidth / 2} cy={window.innerHeight / 2} onDone={dismiss} />);
    setTimeout(doZap, 680);
  };

  const handleOptionClick = optId => {
    if (hasVoted || isExpired) return;
    if (isZapPoll) {
      setZapTargetOption(optId);
      setShowZapModal(true);
    } else {
      handleStandardVote(optId);
    }
  };

  return (
    <>
      <div className="note-card" style={{ animationDelay: `${delay}s`, zIndex: cardMenuOpen ? 1 : undefined }} onClick={() => (onOpenPoll ?? onOpenThread)?.(event)}>
        <div className="note-header">
          <div onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }} style={{ cursor: "pointer", flexShrink: 0 }}>
            <Avatar pk={event.pubkey} profiles={profiles} size={36} />
          </div>
          <div className="note-meta">
            <div className="note-meta-top">
              <span className="note-name" style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
                {displayName(event.pubkey, profiles)}
              </span>
              <span className="meta-dot" aria-hidden="true">·</span>
              <span className="note-time">{relativeTime(event.created_at)}</span>
            </div>
            <span className="note-npub">{nip05OrNpub(event.pubkey, profiles)}</span>
          </div>
          <button
            type="button"
            className="note-card-menu-btn"
            onClick={e => { e.stopPropagation(); setCardMenuOpen(v => !v); }}
            aria-label="More options"
          >
            <span /><span /><span />
          </button>
          {cardMenuOpen && (
            <NoteContextMenu
              event={event}
              onClose={() => setCardMenuOpen(false)}
              onViewJson={() => setJsonOpen(true)}
              publishEvent={publishEvent}
              onDeleted={() => setDeleted(true)}
            />
          )}
        </div>

        <span className="poll-badge">{isZapPoll ? "⚡ Zap Poll" : "Poll"}</span>

            <NoteContent
              content={event.content}
              profiles={profiles}
              onOpenProfile={onOpenProfile}
              onOpenHashtag={onOpenHashtag}
              allEvents={events}
              onOpenThread={onOpenThread}
              resolveEventById={resolveEventById}
              allowEmbeds={false}
              className="poll-question"
            />

            <div className="poll-options">
              {options.map(opt => {
                const count = effectiveCounts[opt.id] ?? 0;
                const p = pct(count, effectiveTotal);
                const isChosen = effectiveVote === opt.id;

                if (showResults) {
                  return (
                    <div key={opt.id} className={`poll-result-row${isChosen ? " poll-chosen" : ""}`}>
                      <div className="poll-bar-wrap">
                        <div className="poll-bar-fill" style={{ "--pct": `${p}%` }} />
                      </div>
                      <div className="poll-result-label">
                        <span className="poll-opt-text">{opt.label}{isChosen && " ✓"}</span>
                        <span className="poll-opt-count">
                          {isZapPoll ? `${fmtSatsVal(count)} sats` : `${count} vote${count !== 1 ? "s" : ""}`}
                          {" · "}{p}%
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    className="poll-option-btn"
                    onClick={e => { e.stopPropagation(); handleOptionClick(opt.id); }}
                    disabled={loading}
                  >
                    {isZapPoll && <span className="poll-zap-icon">⚡</span>}
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {!loading && (
              <div className="poll-footer" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  className="poll-votes-link"
                  onClick={() => onOpenVotes?.({ event, options, voteEvents, isZapPoll })}
                >
                  {voterCount} vote{voterCount !== 1 ? "s" : ""}
                </button>
                {!hasVoted && !isExpired && (
                  <>
                    {" · "}
                    <button type="button" className="poll-votes-link" onClick={() => setViewResults(v => !v)}>
                      {viewResults ? "Hide results" : "View results"}
                    </button>
                  </>
                )}
                {expiry && <>{" · "}<ExpiryLine expiry={expiry} isExpired={isExpired} /></>}
              </div>
            )}

            {polltype === "multiplechoice" && !showResults && (
              <div className="poll-footer" style={{ marginTop: 2 }}>Multiple choice</div>
            )}

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
              onBookmark={null}
              isBookmarked={() => false}
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

      {showZapModal && createPortal(
        <ZapModal
          event={event}
          profiles={profiles}
          defaultAmount={defaultZapAmount}
          defaultMsg={defaultZapMsg}
          onZap={handleZapVoteFromModal}
          onDismiss={() => { setShowZapModal(false); setZapTargetOption(null); }}
        />,
        document.body
      )}
      {localModal && createPortal(localModal, document.body)}
      {jsonOpen && <NoteJsonModal event={event} onClose={() => setJsonOpen(false)} />}
    </>
  );
}

export default memo(PollCard);
