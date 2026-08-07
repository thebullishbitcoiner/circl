import { useState } from "react";
import { createPortal } from "react-dom";
import ZapModal from "./ZapModal.jsx";
import ZapAnimation from "./ZapAnimation.jsx";
import { fmtSatsVal } from "../utils.js";
import usePollData from "../hooks/usePollData.js";

function pct(count, total) { return total ? Math.round((count / total) * 100) : 0; }

export default function PollInline({
  event, myPubkey, sendZap, defaultZapAmount, defaultZapMsg, onZapFail,
  profiles, publishEvent, onRequestModal, onDismissModal, onOpenVotes,
}) {
  const { options, voteCounts, myVote, total, isExpired, expiry, loading, zapLimits, voteEvents, voterCount } = usePollData({ event, myPubkey });
  const isZapPoll = event.kind === 6969;
  const [localVote, setLocalVote] = useState(null);
  const [localCounts, setLocalCounts] = useState(null);
  const [zapTarget, setZapTarget] = useState(null);
  const [showZapModal, setShowZapModal] = useState(false);
  const [localModal, setLocalModal] = useState(null);
  const [viewResults, setViewResults] = useState(false);

  const effectiveVote = localVote ?? myVote;
  const effectiveCounts = localCounts ?? voteCounts;
  const effectiveTotal = localCounts ? Object.values(localCounts).reduce((s, v) => s + v, 0) : total;
  const hasVoted = !!effectiveVote;
  const showResults = hasVoted || isExpired || viewResults;
  const recipientLnAddr = profiles[event.pubkey]?.lud16 || profiles[event.pubkey]?.lud06 || null;

  const dismiss = () => { onDismissModal?.(); setLocalModal(null); };
  const openModal = node => { if (onRequestModal) onRequestModal(node); else setLocalModal(node); };

  const handleStandardVote = optId => {
    if (hasVoted || isExpired) return;
    setLocalVote(optId);
    setLocalCounts(prev => { const b = prev ?? voteCounts; return { ...b, [optId]: (b[optId] ?? 0) + 1 }; });
    publishEvent?.({ kind: 1018, content: "", tags: [["e", event.id], ["p", event.pubkey], ["response", optId]] });
  };

  const handleZapVote = ({ amount, msg }) => {
    setShowZapModal(false);
    const optId = zapTarget; setZapTarget(null);
    if (!optId) return;
    setLocalVote(optId);
    setLocalCounts(prev => { const b = prev ?? voteCounts; return { ...b, [optId]: (b[optId] ?? 0) + amount }; });
    openModal(<ZapAnimation cx={window.innerWidth / 2} cy={window.innerHeight / 2} onDone={dismiss} />);
    setTimeout(async () => {
      if (!sendZap) { onZapFail?.("no_wallet"); return; }
      if (!recipientLnAddr) { onZapFail?.("no_lud16"); return; }
      const r = await sendZap({ amountSats: amount, recipientLnAddr, recipientPubkey: event.pubkey, eventId: event.id, eventKind: event.kind, msg, pollOption: optId });
      if (!r.ok) onZapFail?.(r.reason);
    }, 680);
  };

  const handleClick = optId => {
    if (hasVoted || isExpired) return;
    if (isZapPoll) { setZapTarget(optId); setShowZapModal(true); }
    else handleStandardVote(optId);
  };

  if (!options.length) return null;

  return (
    <>
      <span className="poll-badge">{isZapPoll ? "⚡ Zap Poll" : "Poll"}</span>
      <div className="poll-options" onClick={e => e.stopPropagation()}>
        {options.map(opt => {
          const count = effectiveCounts[opt.id] ?? 0;
          const p = pct(count, effectiveTotal);
          const isChosen = effectiveVote === opt.id;
          if (showResults) {
            return (
              <div key={opt.id} className={`poll-result-row${isChosen ? " poll-chosen" : ""}`}>
                <div className="poll-bar-wrap"><div className="poll-bar-fill" style={{ "--pct": `${p}%` }} /></div>
                <div className="poll-result-label">
                  <span className="poll-opt-text">{opt.label}{isChosen && " ✓"}</span>
                  <span className="poll-opt-count">{isZapPoll ? `${fmtSatsVal(count)} sats` : `${count} vote${count !== 1 ? "s" : ""}`} · {p}%</span>
                </div>
              </div>
            );
          }
          return (
            <button key={opt.id} type="button" className="poll-option-btn" onClick={() => handleClick(opt.id)} disabled={loading}>
              {isZapPoll && <span className="poll-zap-icon">⚡</span>}{opt.label}
            </button>
          );
        })}
      </div>
      {!loading && (
        <div className="poll-footer" onClick={e => e.stopPropagation()}>
          <button type="button" className="poll-votes-link" onClick={() => onOpenVotes?.({ event, options, voteEvents, isZapPoll })}>
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
          {expiry && <>{" · "}<span>{isExpired ? "Ended" : (() => { const s = expiry - Math.floor(Date.now() / 1000); const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); return d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h left` : "Ending soon"; })()}</span></>}
        </div>
      )}
      {showZapModal && createPortal(<ZapModal event={event} profiles={profiles} defaultAmount={defaultZapAmount} defaultMsg={defaultZapMsg} onZap={handleZapVote} onDismiss={() => { setShowZapModal(false); setZapTarget(null); }} />, document.body)}
      {localModal && createPortal(localModal, document.body)}
    </>
  );
}
