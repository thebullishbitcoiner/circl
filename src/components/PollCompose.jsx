export default function PollCompose({
  pollType, onChangePollType,
  options, onChangeOptions,
  pollChoice, onChangePollChoice,
  expiry, onChangeExpiry,
  zapMin, onChangeZapMin,
  zapMax, onChangeZapMax,
}) {
  const isZap = pollType === "zap";

  const setOption = (i, val) => {
    const next = [...options];
    next[i] = val;
    onChangeOptions(next);
  };

  const addOption = () => {
    if (options.length >= 4) return;
    onChangeOptions([...options, ""]);
  };

  const removeOption = i => {
    if (options.length <= 2) return;
    onChangeOptions(options.filter((_, j) => j !== i));
  };

  return (
    <div className="poll-compose" onClick={e => e.stopPropagation()}>
      <div className="poll-compose-type-row">
        <button
          type="button"
          className={`poll-type-btn${!isZap ? " active" : ""}`}
          onClick={() => onChangePollType("standard")}
        >
          Poll
        </button>
        <button
          type="button"
          className={`poll-type-btn${isZap ? " active" : ""}`}
          onClick={() => onChangePollType("zap")}
        >
          ⚡ Zap Poll
        </button>
      </div>

      <div className="poll-compose-options">
        {options.map((opt, i) => (
          <div key={i} className="poll-compose-option-row">
            <input
              type="text"
              className="poll-compose-option-input"
              placeholder={`Option ${i + 1}`}
              value={opt}
              onChange={e => setOption(i, e.target.value)}
              maxLength={100}
            />
            {options.length > 2 && (
              <button type="button" className="poll-compose-remove" onClick={() => removeOption(i)} aria-label="Remove option">✕</button>
            )}
          </div>
        ))}
        {options.length < 4 && (
          <button type="button" className="poll-compose-add-opt" onClick={addOption}>+ Add option</button>
        )}
      </div>

      {!isZap && (
        <div className="poll-compose-row">
          <label className="poll-compose-label">Type</label>
          <div className="poll-compose-type-row" style={{ gap: 8 }}>
            <button
              type="button"
              className={`poll-type-btn${pollChoice === "singlechoice" ? " active" : ""}`}
              onClick={() => onChangePollChoice("singlechoice")}
            >
              Single choice
            </button>
            <button
              type="button"
              className={`poll-type-btn${pollChoice === "multiplechoice" ? " active" : ""}`}
              onClick={() => onChangePollChoice("multiplechoice")}
            >
              Multiple choice
            </button>
          </div>
        </div>
      )}

      {isZap && (
        <div className="poll-compose-row">
          <label className="poll-compose-label">Sats range (optional)</label>
          <div className="poll-compose-zap-limits">
            <input
              type="number"
              className="poll-compose-option-input"
              placeholder="Min sats"
              value={zapMin}
              onChange={e => onChangeZapMin(e.target.value)}
              min={1}
              style={{ flex: 1 }}
            />
            <span style={{ color: "var(--text-faint)", fontSize: 13 }}>–</span>
            <input
              type="number"
              className="poll-compose-option-input"
              placeholder="Max sats"
              value={zapMax}
              onChange={e => onChangeZapMax(e.target.value)}
              min={1}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      )}

      <div className="poll-compose-row">
        <label className="poll-compose-label">Ends at (optional)</label>
        <input
          type="datetime-local"
          className="poll-compose-option-input"
          value={expiry}
          onChange={e => onChangeExpiry(e.target.value)}
        />
      </div>
    </div>
  );
}
