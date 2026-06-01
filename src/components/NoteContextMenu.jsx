import { nip19 } from "../utils.js";
import { broadcastEvent } from "../nostr.js";

export default function NoteContextMenu({ event, onClose, onViewJson }) {
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

  return (
    <div className="note-card-menu" onClick={e => e.stopPropagation()}>
      <button type="button" className="note-card-menu-item" onClick={copyText}>Copy Note Text</button>
      <button type="button" className="note-card-menu-item" onClick={copyId}>Copy Note ID</button>
      <button type="button" className="note-card-menu-item" onClick={handleBroadcast}>Broadcast</button>
      <button type="button" className="note-card-menu-item" onClick={() => { onClose(); onViewJson(event); }}>View JSON</button>
    </div>
  );
}
