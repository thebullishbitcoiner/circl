import { useNavigation } from "../context/NavigationContext.jsx";

export default function ProfileContextMenu({ pubkey, onClose }) {
  const { isMuted, onMuteUser, onUnmuteUser } = useNavigation();
  const muted = isMuted?.(pubkey);

  const handleMute = () => {
    if (muted) onUnmuteUser?.(pubkey);
    else onMuteUser?.(pubkey);
    onClose();
  };

  return (
    <div className="note-card-menu" onClick={e => e.stopPropagation()}>
      <button type="button" className={`note-card-menu-item${muted ? "" : " note-card-menu-item--danger"}`} onClick={handleMute}>
        {muted ? "Unmute User" : "Mute User"}
      </button>
    </div>
  );
}
