import { useEffect, useRef } from "react";
import { nip19 } from "../utils.js";
import { broadcastEvent } from "../nostr.js";
import { useNavigation } from "../context/NavigationContext.jsx";

export default function NoteContextMenu({ event, onClose, onViewJson }) {
  const { isMuted, onMuteUser, onUnmuteUser, myPubkey } = useNavigation();
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8) {
      menuRef.current.style.top = "auto";
      menuRef.current.style.bottom = "100%";
    }
  }, []);
  const copyText = () => {
    navigator.clipboard?.writeText(event.content || "").catch(() => {});
    onClose();
  };

  const copyId = () => {
    let encoded = event.id || "";
    try { encoded = "nostr:" + nip19.neventEncode({ id: event.id }); } catch {}
    navigator.clipboard?.writeText(encoded).catch(() => {});
    onClose();
  };

  const handleBroadcast = () => {
    broadcastEvent(event);
    onClose();
  };

  const authorMuted = isMuted?.(event.pubkey);
  const isOwnNote = event.pubkey === myPubkey;

  const handleMute = () => {
    if (authorMuted) onUnmuteUser?.(event.pubkey);
    else onMuteUser?.(event.pubkey);
    onClose();
  };

  return (
    <div ref={menuRef} className="note-card-menu" onClick={e => e.stopPropagation()}>
      <button type="button" className="note-card-menu-item" onClick={copyText}>Copy Note Text</button>
      <button type="button" className="note-card-menu-item" onClick={copyId}>Copy Note ID</button>
      <button type="button" className="note-card-menu-item" onClick={handleBroadcast}>Broadcast</button>
      <button type="button" className="note-card-menu-item" onClick={() => { onClose(); onViewJson(event); }}>View JSON</button>
      {!isOwnNote && (
        <button type="button" className="note-card-menu-item note-card-menu-item--danger" onClick={handleMute}>
          {authorMuted ? "Unmute User" : "Mute User"}
        </button>
      )}
    </div>
  );
}
