import { useState, useEffect, useMemo, useRef } from "react";
import { useObservableState } from "applesauce-react/hooks";
import { WrappedMessagesGroups, WrappedMessagesGroup } from "applesauce-common/models/wrapped-messages";
import { groupMessageEvents } from "applesauce-common/helpers/messages";
import { eventStore } from "../nostr.js";
import { displayName, relativeTime, nip19 } from "../utils.js";
import Avatar from "./Avatar.jsx";
import { Bk, Snd, Pe } from "./icons.jsx";

function ConversationList({ conversations, pubkey, profiles, selected, onSelect }) {
  if (!conversations?.length) {
    return (
      <div className="empty-state" style={{ paddingTop: 40 }}>
        <div className="empty-state-title">No messages yet</div>
        <div className="empty-state-sub">Tap + to start a conversation</div>
      </div>
    );
  }

  const sorted = [...conversations].sort((a, b) =>
    (b.lastMessage?.created_at ?? 0) - (a.lastMessage?.created_at ?? 0)
  );

  return (
    <div>
      {sorted.map(({ id, participants, lastMessage }) => {
        const others = participants.filter(p => p !== pubkey);
        const isOwn = lastMessage?.pubkey === pubkey;
        const preview = lastMessage
          ? (isOwn ? `You: ${lastMessage.content}` : lastMessage.content)
          : null;
        return (
          <div key={id}
            role="button" tabIndex={0}
            className={`dm-conv-row${selected === id ? " active" : ""}`}
            onClick={() => onSelect(id, participants)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelect(id, participants); }}
          >
            <div style={{ display: "flex", flexShrink: 0, position: "relative" }}>
              {others.slice(0, 2).map((pk, i) => (
                <div key={pk} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 2 - i }}>
                  <Avatar pk={pk} profiles={profiles} size={44} />
                </div>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
                <span className="dm-conv-name">
                  {others.map(p => displayName(p, profiles)).join(", ")}
                </span>
                {lastMessage && (
                  <span className="dm-conv-time">{relativeTime(lastMessage.created_at)}</span>
                )}
              </div>
              {preview && (
                <div className="dm-conv-preview">{preview}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConversationView({ pubkey, conversationId, participants, profiles, onSend, onOpenProfile, onBack }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const messages$ = useMemo(
    () => eventStore.model(WrappedMessagesGroup, pubkey, conversationId),
    [pubkey, conversationId]
  );
  const messages = useObservableState(messages$);

  const groups = useMemo(() => {
    if (!messages?.length) return [];
    return groupMessageEvents([...messages].sort((a, b) => a.created_at - b.created_at), 5 * 60);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groups.length]);

  const others = participants.filter(p => p !== pubkey);

  const handleSend = async e => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSend(participants, text.trim());
      setText("");
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="dm-thread">
      <div className="dm-thread-header">
        {onBack && (
          <button type="button" className="dm-back-btn" onClick={onBack}>
            <Bk s={16} />
          </button>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          {others.slice(0, 2).map((pk, i) => (
            <div key={pk} style={{ marginLeft: i === 0 ? 0 : -8, cursor: "pointer" }} onClick={() => onOpenProfile?.(pk)}>
              <Avatar pk={pk} profiles={profiles} size={28} />
            </div>
          ))}
        </div>
        <span className="dm-thread-name">{others.map(p => displayName(p, profiles)).join(", ")}</span>
      </div>

      <div className="dm-messages">
        {!groups.length && (
          <div style={{ textAlign: "center", color: "var(--text-faint)", fontSize: 13, paddingTop: 32 }}>
            Say hello 👋
          </div>
        )}
        {groups.map(group => {
          const isOwn = group[0].pubkey === pubkey;
          return (
            <div key={group[0].id} className={`dm-group${isOwn ? " own" : ""}`}>
              {!isOwn && (
                <div className="dm-group-meta">
                  <div style={{ cursor: "pointer" }} onClick={() => onOpenProfile?.(group[0].pubkey)}>
                    <Avatar pk={group[0].pubkey} profiles={profiles} size={20} />
                  </div>
                  <span className="dm-group-name">{displayName(group[0].pubkey, profiles)}</span>
                  <span className="dm-group-time">{relativeTime(group[0].created_at)}</span>
                </div>
              )}
              {isOwn && <div className="dm-group-time own">{relativeTime(group[0].created_at)}</div>}
              {[...group].reverse().map(msg => (
                <div key={msg.id} className={`dm-bubble${isOwn ? " own" : ""}`}>{msg.content}</div>
              ))}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form className="dm-compose" onSubmit={handleSend}>
        <input
          className="dm-input"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Message…"
          disabled={sending}
        />
        <button type="submit" className="dm-send-btn" disabled={sending || !text.trim()}>
          <Snd s={17} />
        </button>
      </form>
    </div>
  );
}

export default function DMsPage({ pubkey, profiles, unlock, unlocking, sendMessage, onOpenProfile }) {
  const [selectedId, setSelectedId] = useState(null);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [newRecipient, setNewRecipient] = useState("");
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (pubkey) unlock();
  }, [pubkey]); // eslint-disable-line

  const conversations$ = useMemo(() => eventStore.model(WrappedMessagesGroups, pubkey), [pubkey]);
  const conversations = useObservableState(conversations$);

  const handleSelect = (id, participants) => {
    setSelectedId(id);
    setSelectedParticipants(participants);
    setShowNew(false);
  };

  const handleBack = () => {
    setSelectedId(null);
    setSelectedParticipants([]);
  };

  const handleStartNew = e => {
    e.preventDefault();
    const trimmed = newRecipient.trim();
    if (!trimmed) return;
    let hex = trimmed;
    try {
      if (trimmed.startsWith("npub")) {
        const d = nip19.decode(trimmed);
        if (d.type === "npub") hex = d.data;
      }
    } catch {}
    if (!hex) return;
    const participants = [pubkey, hex];
    const id = [...participants].sort().join(":");
    handleSelect(id, participants);
    setNewRecipient("");
    setShowNew(false);
  };

  return (
    <div className="dm-shell">
      {/* Sidebar — hidden on mobile when a conversation is open */}
      <div className={`dm-sidebar${selectedId ? " dm-sidebar-hidden" : ""}`}>
        <div className="dm-sidebar-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="dm-sidebar-title">Messages</span>
            {unlocking && (
              <div style={{ width: 12, height: 12, border: "1.5px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite", flexShrink: 0 }} />
            )}
          </div>
        </div>

        {showNew && (
          <form onSubmit={handleStartNew} className="dm-new-form">
            <input
              className="dm-input"
              placeholder="npub or hex pubkey…"
              value={newRecipient}
              onChange={e => setNewRecipient(e.target.value)}
              autoFocus
            />
          </form>
        )}

        <div className="dm-conv-list">
          <ConversationList
            conversations={conversations}
            pubkey={pubkey}
            profiles={profiles}
            selected={selectedId}
            onSelect={handleSelect}
          />
        </div>

        <button type="button" className="dm-fab" onClick={() => setShowNew(v => !v)} title="New message">
          <Pe s={20} />
        </button>
      </div>

      {/* Conversation view */}
      <div className={`dm-main${!selectedId ? " dm-main-hidden" : ""}`}>
        {selectedId ? (
          <ConversationView
            pubkey={pubkey}
            conversationId={selectedId}
            participants={selectedParticipants}
            profiles={profiles}
            onSend={sendMessage}
            onOpenProfile={onOpenProfile}
            onBack={handleBack}
          />
        ) : (
          <div className="dm-empty">Select a conversation</div>
        )}
      </div>
    </div>
  );
}
