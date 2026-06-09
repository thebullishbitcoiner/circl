import Overlay from "./Overlay.jsx";
import EmojiPicker from "./EmojiPicker.jsx";

export default function EmojiPickerSheet({ onPick, onDismiss, customEmojis }) {
  return (
    <Overlay onDismiss={onDismiss}>
      <div className="emoji-reaction-sheet" onClick={e => e.stopPropagation()}>
        <EmojiPicker
          customEmojis={customEmojis}
          onSelect={emoji => { onPick?.(emoji); onDismiss?.(); }}
        />
      </div>
    </Overlay>
  );
}
