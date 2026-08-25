import { useState, useEffect, useRef } from "react";
import { nip19 } from "../utils.js";
import { broadcastEvent } from "../nostr.js";
import { useNavigation } from "../context/NavigationContext.jsx";
import NoteDetailsModal from "./NoteDetailsModal.jsx";

export default function NoteContextMenu({ event, onClose, onViewJson, publishEvent, onDeleted }) {
  const { isMuted, onMuteUser, onUnmuteUser, myPubkey, onTogglePin, isPinned, mutedThreads, onMuteThread, onUnmuteThread } = useNavigation();
  const menuRef = useRef(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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

  // NIP-51 mute lists store the thread *root* id — resolve it from the NIP-10
  // root marker (kind 1) or the NIP-22 uppercase "E" tag (kind 1111/1244) so
  // muting from any reply silences the whole thread.
  const threadRootId =
    event.tags?.find(t => t[0] === "e" && t[3] === "root")?.[1] ??
    event.tags?.find(t => t[0] === "E")?.[1] ??
    event.id;
  const threadMuted = mutedThreads?.includes(threadRootId);
  const canMuteThread = [1, 1111, 1244].includes(event.kind) && !!(onMuteThread || onUnmuteThread);

  const handleMuteThread = () => {
    if (threadMuted) onUnmuteThread?.(threadRootId);
    else onMuteThread?.(threadRootId);
    onClose();
  };

  const handleRequestDelete = async () => {
    if (!publishEvent) return;
    onClose();
    const tags = [["e", event.id]];
    if (event.kind >= 30000 && event.kind < 40000) {
      const dTag = event.tags?.find(t => t[0] === "d")?.[1] ?? "";
      tags.unshift(["a", `${event.kind}:${event.pubkey}:${dTag}`]);
    }
    await publishEvent({ kind: 5, content: "", tags });
    onDeleted?.();
  };

  if (detailsOpen) {
    return <NoteDetailsModal event={event} onClose={() => { setDetailsOpen(false); onClose(); }} />;
  }

  return (
    <div ref={menuRef} className="note-card-menu" onClick={e => e.stopPropagation()}>
      <button type="button" className="note-card-menu-item" onClick={copyText}>Copy Note Text</button>
      <button type="button" className="note-card-menu-item" onClick={copyId}>Copy Note ID</button>
      <button type="button" className="note-card-menu-item" onClick={handleBroadcast}>Broadcast</button>
      <button type="button" className="note-card-menu-item" onClick={() => setDetailsOpen(true)}>Post Details</button>
      <button type="button" className="note-card-menu-item" onClick={() => { onClose(); onViewJson(event); }}>View JSON</button>
      {!isOwnNote && (
        <button type="button" className="note-card-menu-item note-card-menu-item--danger" onClick={handleMute}>
          {authorMuted ? "Unmute User" : "Mute User"}
        </button>
      )}
      {canMuteThread && (
        <button type="button" className="note-card-menu-item note-card-menu-item--danger" onClick={handleMuteThread}>
          {threadMuted ? "Unmute Thread" : "Mute Thread"}
        </button>
      )}
      {isOwnNote && [1, 1068, 6969].includes(event.kind) && onTogglePin && (
        <button type="button" className="note-card-menu-item" onClick={() => { onTogglePin(event); onClose(); }}>
          {isPinned?.(event) ? "Unpin from Profile" : "Pin to Profile"}
        </button>
      )}
      {isOwnNote && publishEvent && (
        <button type="button" className="note-card-menu-item note-card-menu-item--danger" onClick={handleRequestDelete}>
          Request Delete
        </button>
      )}
    </div>
  );
}
