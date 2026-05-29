import Overlay from "./Overlay.jsx";
import EmojiPicker from "./EmojiPicker.jsx";

export default function EmojiPickerSheet({ onPick, onDismiss }) {
  return (
    <Overlay onDismiss={onDismiss}>
      <div className="emoji-reaction-sheet" onClick={e => e.stopPropagation()}>
        <EmojiPicker onSelect={emoji => { onPick?.(emoji); onDismiss?.(); }} />
      </div>
    </Overlay>
  );
}
