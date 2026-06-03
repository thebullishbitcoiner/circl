export default function GoalCompose({
  title, onChangeTitle,
  description, onChangeDescription,
  amount, onChangeAmount,
  closedAt, onChangeClosedAt,
  image, onChangeImage,
}) {
  return (
    <div className="poll-compose" onClick={e => e.stopPropagation()}>
      <div className="poll-compose-row">
        <label className="poll-compose-label">Title *</label>
        <input
          type="text"
          className="poll-compose-option-input"
          placeholder="What are you raising sats for?"
          value={title}
          onChange={e => onChangeTitle(e.target.value)}
          maxLength={200}
          autoFocus
        />
      </div>

      <div className="poll-compose-row">
        <label className="poll-compose-label">Description (optional)</label>
        <textarea
          className="poll-compose-option-input goal-compose-description"
          placeholder="More detail about your goal…"
          value={description}
          onChange={e => onChangeDescription(e.target.value)}
          rows={3}
        />
      </div>

      <div className="poll-compose-row">
        <label className="poll-compose-label">Target amount (sats) *</label>
        <input
          type="number"
          className="poll-compose-option-input"
          placeholder="e.g. 100000"
          value={amount}
          onChange={e => onChangeAmount(e.target.value)}
          min={1}
          step={1}
        />
      </div>

      <div className="poll-compose-row">
        <label className="poll-compose-label">Close date (optional)</label>
        <input
          type="datetime-local"
          className="poll-compose-option-input"
          value={closedAt}
          onChange={e => onChangeClosedAt(e.target.value)}
        />
      </div>

      <div className="poll-compose-row">
        <label className="poll-compose-label">Image URL (optional)</label>
        <input
          type="url"
          className="poll-compose-option-input"
          placeholder="https://..."
          value={image}
          onChange={e => onChangeImage(e.target.value)}
        />
        {image && (
          <img
            src={image}
            alt=""
            className="goal-compose-preview"
            onError={e => { e.target.style.display = "none"; }}
            onLoad={e => { e.target.style.display = "block"; }}
          />
        )}
      </div>
    </div>
  );
}
