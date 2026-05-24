import { useState, useEffect, useMemo, useRef } from "react";
import { use$ } from "applesauce-react/hooks";
import { catchError, EMPTY, map } from "rxjs";
import { mapEventsToStore } from "applesauce-core/observable/map-events-to-store";
import { watchEventsUpdates } from "applesauce-core/observable";
import { GiftWrapsModel, WrappedMessagesGroup } from "applesauce-common/models";
import { getGiftWrapRumor } from "applesauce-common/helpers/gift-wrap";
import {
  unlockGiftWrap,
  persistEncryptedContent,
  getConversationIdentifierFromMessage,
  getConversationParticipants,
  groupMessageEvents,
} from "applesauce-common/helpers";
import { ActionRunner } from "applesauce-actions";
import { SendWrappedMessage } from "applesauce-actions/actions";
import { ExtensionSigner } from "applesauce-signers";
import { kinds } from "nostr-tools";
import { eventStore, pool } from "../nostr.js";
import { RELAYS } from "../constants.js";
import { displayName, relativeTime, nip19 } from "../utils.js";
import Avatar from "./Avatar.jsx";
import { Bk, Snd, Pe } from "./icons.jsx";

// ── Safe WrappedMessagesModel ─────────────────────────────────────────────────
// Wraps getGiftWrapRumor per-event so a single malformed gift wrap doesn't
// crash the whole observable (applesauce throws instead of returning undefined).
function SafeWrappedMessagesModel(self) {
  return store => store.timeline({ kinds: [kinds.GiftWrap], "#p": [self] }).pipe(
    watchEventsUpdates(store),
    map(gifts => gifts
      .map(gift => { try { return getGiftWrapRumor(gift); } catch { return undefined; } })
      .filter(e => !!e && e.kind === kinds.PrivateDirectMessage)
      .sort((a, b) => b.created_at - a.created_at)
    )
  );
}

// ── Encrypted-content cache (localStorage) ───────────────────────────────────
// Persists decrypted gift-wrap / seal plaintext so the signer is only called
// once per gift wrap — subsequent page loads restore from this cache.
// ⚠ Content is stored unencrypted. A production upgrade would use a
//   password-protected store (like the applesauce SecureStorage example).
const CACHE_PREFIX = "circl_dm_";
const dmCache = {
  getItem: async id => { try { return localStorage.getItem(CACHE_PREFIX + id) ?? null; } catch { return null; } },
  setItem: async (id, v) => { try { localStorage.setItem(CACHE_PREFIX + id, v); } catch {} },
};
persistEncryptedContent(eventStore, dmCache);

// ── Failed gift-wrap tracking ─────────────────────────────────────────────────
const FAILED_KEY = "circl_dm_failed";
const getFailed = () => { try { return JSON.parse(localStorage.getItem(FAILED_KEY) ?? "[]"); } catch { return []; } };
const addFailed = id => { const f = getFailed(); if (!f.includes(id)) localStorage.setItem(FAILED_KEY, JSON.stringify([...f, id])); };
const clearFailed = () => localStorage.removeItem(FAILED_KEY);

// ── Shared signer ─────────────────────────────────────────────────────────────
const _signer = new ExtensionSigner();

// ─────────────────────────────────────────────────────────────────────────────

function ConversationView({ pubkey, convId, participants, profiles, actionsRef, onOpenProfile, onBack }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const messages = use$(() => eventStore.model(WrappedMessagesGroup, pubkey, participants), [pubkey, convId]);

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
      await actionsRef.current?.run(SendWrappedMessage, participants, text.trim());
      setText("");
    } catch (err) {
      console.error("[DMs] Send failed:", err);
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

export default function DMsPage({ pubkey, profiles, onOpenProfile }) {
  const [selectedConv, setSelectedConv] = useState(null);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [unlocking, setUnlocking] = useState(false);
  const [failedCount, setFailedCount] = useState(() => getFailed().length);
  const [dmRelays, setDmRelays] = useState(RELAYS);
  const [showNew, setShowNew] = useState(false);
  const [newRecipient, setNewRecipient] = useState("");
  const actionsRef = useRef(null);

  // Build action runner
  useEffect(() => {
    if (!pubkey) return;
    actionsRef.current = new ActionRunner(eventStore, _signer, async (event, relays) => {
      await pool.publish(relays || dmRelays, event);
      // Immediately cache self-addressed wraps so sent messages appear without relay round-trip
      if (event.kind === kinds.GiftWrap && event.tags.some(t => t[0] === "p" && t[1] === pubkey)) {
        const stored = eventStore.add(event);
        unlockGiftWrap(stored, _signer).catch(() => {});
      }
    });
  }, [pubkey, dmRelays]);

  // Fetch DM relay list (kind 10050)
  useEffect(() => {
    if (!pubkey) return;
    const sub = pool.subscription(RELAYS, { kinds: [kinds.DirectMessageRelaysList], authors: [pubkey], limit: 1 })
      .pipe(mapEventsToStore(eventStore))
      .subscribe(ev => {
        const relays = ev.tags.filter(t => t[0] === "relay").map(t => t[1]).filter(Boolean);
        if (relays.length) setDmRelays(relays);
      });
    return () => sub.unsubscribe();
  }, [pubkey]);

  // Subscribe to gift wraps and unlock each as it arrives
  useEffect(() => {
    if (!pubkey) return;
    const relays = [...new Set([...RELAYS, ...dmRelays])];
    const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 365;
    const sub = pool.subscription(relays, {
      kinds: [kinds.GiftWrap],
      "#p": [pubkey],
      since,
    }).pipe(
      mapEventsToStore(eventStore),
      catchError(() => EMPTY),
    ).subscribe(ev => {
      if (getFailed().includes(ev.id)) return;
      unlockGiftWrap(ev, _signer).catch(() => {
        addFailed(ev.id);
        setFailedCount(getFailed().length);
      });
    });
    return () => sub.unsubscribe();
  }, [pubkey, dmRelays.join(",")]);

  // Locked gift wraps (excluding already-failed ones)
  const locked = use$(() =>
    eventStore.model(GiftWrapsModel, pubkey, false).pipe(
      map(events => events.filter(e => !getFailed().includes(e.id)))
    ),
    [pubkey, failedCount]
  );

  // All unlocked messages → group into conversations
  const allMessages = use$(() => eventStore.model(SafeWrappedMessagesModel, pubkey), [pubkey]);

  const conversations = useMemo(() => {
    if (!allMessages?.length) return [];
    const convMap = new Map();
    for (const msg of allMessages) {
      const id = getConversationIdentifierFromMessage(msg);
      if (!convMap.has(id) || convMap.get(id).lastMessage.created_at < msg.created_at) {
        convMap.set(id, { id, participants: getConversationParticipants(msg), lastMessage: msg });
      }
    }
    return [...convMap.values()].sort((a, b) => b.lastMessage.created_at - a.lastMessage.created_at);
  }, [allMessages]);

  const handleSelect = (id, participants) => {
    setSelectedConv(id);
    setSelectedParticipants(participants);
    setShowNew(false);
  };

  const handleBack = () => {
    setSelectedConv(null);
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

  const unlock = async () => {
    if (!locked?.length || unlocking) return;
    setUnlocking(true);
    const failed = getFailed();
    for (const gift of locked) {
      if (failed.includes(gift.id)) continue;
      try {
        await unlockGiftWrap(gift, _signer);
      } catch {
        addFailed(gift.id);
      }
    }
    setFailedCount(getFailed().length);
    setUnlocking(false);
  };

  const lockedCount = locked?.length ?? 0;

  return (
    <div className="dm-shell">
      <div className={`dm-sidebar${selectedConv ? " dm-sidebar-hidden" : ""}`}>
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
          {conversations.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: 40 }}>
              <div className="empty-state-title">{unlocking ? "Unlocking…" : "No messages yet"}</div>
              <div className="empty-state-sub">Tap + to start a conversation</div>
            </div>
          ) : (
            conversations.map(conv => {
              const others = conv.participants.filter(p => p !== pubkey);
              const isOwn = conv.lastMessage.pubkey === pubkey;
              return (
                <div
                  key={conv.id}
                  role="button" tabIndex={0}
                  className={`dm-conv-row${selectedConv === conv.id ? " active" : ""}`}
                  onClick={() => handleSelect(conv.id, conv.participants)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleSelect(conv.id, conv.participants); }}
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
                      <span className="dm-conv-name">{others.map(p => displayName(p, profiles)).join(", ")}</span>
                      <span className="dm-conv-time">{relativeTime(conv.lastMessage.created_at)}</span>
                    </div>
                    <div className="dm-conv-preview">
                      {isOwn ? `You: ${conv.lastMessage.content}` : conv.lastMessage.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {lockedCount > 0 && (
          <button type="button" className="dm-unlock-btn" onClick={unlock} disabled={unlocking}>
            {unlocking ? "Unlocking…" : `Unlock ${lockedCount} message${lockedCount === 1 ? "" : "s"}`}
          </button>
        )}

        <button type="button" className="dm-fab" onClick={() => setShowNew(v => !v)} title="New message">
          <Pe s={20} />
        </button>
      </div>

      <div className={`dm-main${!selectedConv ? " dm-main-hidden" : ""}`}>
        {selectedConv ? (
          <ConversationView
            pubkey={pubkey}
            convId={selectedConv}
            participants={selectedParticipants}
            profiles={profiles}
            actionsRef={actionsRef}
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
