import Overlay from "./Overlay.jsx";
import { REACTION_EMOJIS } from "../constants.js";

export default function EmojiPickerSheet({ onPick, onDismiss }) {
  return (
    <Overlay onDismiss={onDismiss}>
      <div className="emoji-picker" onClick={e => e.stopPropagation()}>
        <div className="emoji-picker-title">React with</div>
        <div className="emoji-grid">
          {REACTION_EMOJIS.map(emoji => (
            <button key={emoji} className="emoji-btn"
              onClick={() => { onPick?.(emoji); onDismiss?.(); }}>
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </Overlay>
  );
}
