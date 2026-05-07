import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import NoteCard from "./NoteCard.jsx";
import NoteActions from "./NoteActions.jsx";
import { Bk, Ck } from "./icons.jsx";
import { displayName, nip05OrNpub, relativeTime, shortNpub, avatarUrl, isQuoteRepost, replyCount, repostAndQuoteCount, normPubkey, directReplyParentId, parseKind6EmbeddedEvent } from "../utils.js";
import { nip19 } from "../utils.js";
import useInteractions from "../hooks/useInteractions.js";

function NpubCopy({ pubkey }) {
  const [copied, setCopied] = useState(false);
  const npub    = nip19.npubEncode(pubkey);
  const clean   = npub.includes("…") ? npub.replace("…", "") : npub;
  const truncated = `${clean.slice(0, 11)}…${clean.slice(-11)}`;

  const handleCopy = e => {
    e.stopPropagation();
    navigator.clipboard.writeText(npub).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="profile-npub">
      <span>{truncated}</span>
      <button onClick={handleCopy} style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 3px", color: copied ? "var(--primary)" : "var(--text-faint)", transition: "color .2s", display: "flex", alignItems: "center" }}>
        {copied
          ? <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12" /></svg>
          : <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
        }
      </button>
    </div>
  );
}

function threadTargetId(e) {
  if (e.kind === 6) return e.tags?.find(t => t[0] === "e")?.[1] ?? null;
  if (isQuoteRepost(e)) return e.tags?.find(t => t[0] === "q")?.[1] ?? null;
  return e.tags?.find(t => t[0] === "e")?.[1] ?? null;
}

function IxNote({ event, myPubkey, profiles, onOpenProfile, onOpenThread, resolveEventById, allEvents, delay }) {
  const isMe = event.pubkey === myPubkey;
  const name = displayName(event.pubkey, profiles);
  const url  = avatarUrl(event.pubkey, profiles);
  const init = shortNpub(event.pubkey)[0];
  const mentionedPk   = event.tags.find(t => t[0] === "p")?.[1];
  const mentionedName = mentionedPk ? displayName(mentionedPk, profiles) : null;

  return (
    <div className="ix-note" style={{ animationDelay: `${delay}s` }}>
      <div className="ix-inner">
        <div className="ix-line-wrap">
          <div className={`ix-av ${isMe ? "is-me" : ""}`} style={{ cursor: "pointer" }} onClick={() => onOpenProfile?.(event.pubkey)}>
            {url ? <img src={url} alt={init} onError={e => { e.target.style.display = "none"; }} /> : init}
          </div>
        </div>
        <div className="ix-body">
          <div className="ix-meta">
            <span className={`ix-name ${isMe ? "is-me" : ""}`} style={{ cursor: "pointer" }} onClick={() => onOpenProfile?.(event.pubkey)}>{name}</span>
            {isMe && <span className="ix-you-badge">you</span>}
            <span className="ix-time">{relativeTime(event.created_at)}</span>
          </div>
          {mentionedName && (
            <div className="ix-direction">
              <span className="ix-dir-arrow">↩</span>
              replying to <span className="ix-mention" style={{ marginLeft: 3 }}>@{mentionedName}</span>
            </div>
          )}
          <NoteContent content={event.content} profiles={profiles} onOpenProfile={onOpenProfile} allEvents={allEvents} onOpenThread={onOpenThread} resolveEventById={resolveEventById} className="ix-text" />
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage({
  pubkey, myPubkey, profiles, follows, events, isOwn,
  onBack, onOpenProfile, onOpenNote, onOpenThread, onOpenZaps, onOpenReactions, onOpenReposts,
  myProfile, onPublish, publishEvent, onPrepend, onBookmark, isBookmarked,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  onRequestModal, onDismissModal, ndk, backLabel = "Your Circle", resolveEventById,
}) {
  const [tab, setTab] = useState("notes");
  const [profileEvents, setProfileEvents] = useState([]);
  const [profileNotesMenuId, setProfileNotesMenuId] = useState(null);
  const [profileNotesJsonEvent, setProfileNotesJsonEvent] = useState(null);
  const [profileNotesJsonCopied, setProfileNotesJsonCopied] = useState(false);
  const p    = profiles?.[pubkey] || {};
  const name = displayName(pubkey, profiles);

  const { extras, loading: ixLoading } = useInteractions({ ndk, myPubkey, otherPubkey: pubkey, feedEvents: events });

  const [repostExtras, setRepostExtras] = useState({});
  const repostFetchRef = useRef(new Set());

  useEffect(() => {
    setProfileNotesMenuId(null);
    setProfileNotesJsonEvent(null);
  }, [tab, pubkey]);

  useEffect(() => {
    setRepostExtras({});
    repostFetchRef.current.clear();
  }, [pubkey]);

  useEffect(() => {
    const instance = ndk?.current;
    if (!pubkey) return;

    let cancelled = false;

    const fetchRelayAll = () => new Promise(resolve => {
      if (!instance) {
        resolve([]);
        return;
      }
      const fetchBatch = until => new Promise(res => {
        const rows = [];
        const sub = instance.subscribe(
          [{ kinds: [1, 6, 30023], authors: [pubkey], limit: 200, until }],
          {}
        );
        sub.on("event", ev => rows.push(ev.rawEvent()));
        sub.on("eose", () => {
          sub.stop();
          res(rows);
        });
      });
      (async () => {
        const byId = new Map();
        let cursor = Math.floor(Date.now() / 1000) + 1;
        while (!cancelled) {
          const batch = await fetchBatch(cursor);
          if (!batch.length) break;
          for (const ev of batch) byId.set(ev.id, ev);
          const oldest = batch.reduce((m, ev) => Math.min(m, ev.created_at || m), cursor);
          if (!Number.isFinite(oldest) || oldest >= cursor) break;
          if (batch.length < 200) break;
          cursor = oldest - 1;
        }
        resolve(Array.from(byId.values()));
      })();
    });

    const isReplyFn = e =>
      e.kind === 1 && e.tags.some(t => t[0] === "e") && !isQuoteRepost(e);
    const topLevelFn = e =>
      e.kind === 6 || isQuoteRepost(e) || (e.kind === 1 && !e.tags.some(t => t[0] === "e"));

    (async () => {
      let apiNotes = null;
      let apiReplies = null;
      try {
        apiNotes = await fetchArchiveProfilePath(pubkey, "notes");
      } catch {
        apiNotes = null;
      }
      try {
        apiReplies = await fetchArchiveProfilePath(pubkey, "replies");
      } catch {
        apiReplies = null;
      }

      let relay = [];
      if (apiNotes === null || apiReplies === null) {
        relay = await fetchRelayAll();
      }

      const byId = new Map();
      const add = arr => {
        for (const ev of arr || []) {
          if (ev?.id) byId.set(ev.id, ev);
        }
      };

      if (apiNotes !== null) add(apiNotes);
      else add(relay.filter(e => e.pubkey === pubkey && topLevelFn(e)));

      if (apiReplies !== null) add(apiReplies);
      else add(relay.filter(e => e.pubkey === pubkey && isReplyFn(e)));

      if (!cancelled) {
        setProfileEvents(Array.from(byId.values()).sort((a, b) => b.created_at - a.created_at));
      }
    })();

    return () => { cancelled = true; };
  }, [ndk, pubkey]);

  const mergedEvents = useMemo(() => {
    const byId = new Map();
    for (const e of events || []) byId.set(e.id, e);
    for (const e of profileEvents || []) byId.set(e.id, e);
    for (const e of Object.values(repostExtras)) byId.set(e.id, e);
    return Array.from(byId.values());
  }, [events, profileEvents, repostExtras]);

  const theirEvents = mergedEvents.filter(e => e.pubkey === pubkey && (e.kind === 1 || e.kind === 6));
  const isReplyFn   = e => e.kind === 1 && e.tags.some(t => t[0] === "e") && !isQuoteRepost(e);

  const topLevel = theirEvents.filter(e =>
    e.kind === 6 || isQuoteRepost(e) || (e.kind === 1 && !e.tags.some(t => t[0] === "e"))
  );
  const replies = theirEvents.filter(isReplyFn);

  useEffect(() => {
    if (!resolveEventById) return;
    let cancelled = false;
    for (const e of topLevel) {
      const tid = threadTargetId(e);
      if (!tid) continue;
      if (e.kind === 6) {
        const emb = parseKind6EmbeddedEvent(e);
        if (emb?.id === tid) continue;
      }
      if (mergedEvents.some(ev => ev.id === tid)) continue;
      if (repostFetchRef.current.has(tid)) continue;
      repostFetchRef.current.add(tid);
      resolveEventById(tid).then(ev => {
        repostFetchRef.current.delete(tid);
        if (cancelled || !ev?.id) return;
        setRepostExtras(prev => (prev[ev.id] ? prev : { ...prev, [ev.id]: ev }));
      }).catch(() => { repostFetchRef.current.delete(tid); });
    }
    return () => { cancelled = true; };
  }, [topLevel, mergedEvents, resolveEventById]);

  const allEvents = [...mergedEvents, ...extras];
  const betweenUs = allEvents
    .filter(e => {
      if (e.kind !== 1) return false;
      const pTags = e.tags.filter(t => t[0] === "p").map(t => t[1]);
      return (e.pubkey === pubkey && pTags.includes(myPubkey)) ||
             (e.pubkey === myPubkey && pTags.includes(pubkey));
    })
    .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
    .sort((a, b) => a.created_at - b.created_at);

  return (
    <div className="slide-panel-scroll">
      <div className="profile-banner" style={{ position: "relative" }}>
        <div className="profile-banner-glyph">◎</div>
        <button className="back-btn" onClick={onBack} style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,.25)", backdropFilter: "blur(8px)", color: "white" }}>
          <Bk s={16} />
        </button>
      </div>

      <div className="profile-identity">
        <div className="profile-av-wrap">
          <div className="profile-av">
            {p.picture
              ? <img src={p.picture} alt={name} onError={e => { e.target.style.display = "none"; }} />
              : name[0]?.toUpperCase()}
          </div>
          {isOwn && <button className="profile-edit-btn">Edit profile</button>}
        </div>
        <div className="profile-name">{name}</div>
        {p.nip05 && <div className="profile-nip05"><div className="profile-nip05-dot" /><Ck s={9} />{p.nip05}</div>}
        <NpubCopy pubkey={pubkey} />
        {p.about && <div className="profile-about">{p.about}</div>}
      </div>

      <div className="profile-stats">
        <div className={`profile-stat ${tab === "notes" ? "active" : ""}`} onClick={() => setTab("notes")}>
          <div className="profile-stat-val">{topLevel.length}</div>
          <div className="profile-stat-label">Notes</div>
        </div>
        <div className={`profile-stat ${tab === "replies" ? "active" : ""}`} onClick={() => setTab("replies")}>
          <div className="profile-stat-val">{replies.length}</div>
          <div className="profile-stat-label">Replies</div>
        </div>
        {isOwn && (
          <div className={`profile-stat ${tab === "circle" ? "active" : ""}`} onClick={() => setTab("circle")}>
            <div className="profile-stat-val">{follows.length}</div>
            <div className="profile-stat-label">Circle</div>
          </div>
        )}
        {!isOwn && (
          <div className={`profile-stat ${tab === "between" ? "active" : ""}`} onClick={() => setTab("between")}>
            <div className="profile-stat-val">{ixLoading ? "…" : betweenUs.length}</div>
            <div className="profile-stat-label">Between us</div>
          </div>
        )}
      </div>

      {/* Circle tab */}
      {tab === "circle" && isOwn && (
        <>
          <div className="circle-header">
            <div className="circle-headline">
              <span>{follows.length}</span> {follows.length === 1 ? "fren" : "frens"}<br />in your circle
            </div>
            <div className="circle-subline">The people whose signal you've chosen to follow</div>
          </div>
          <div className="circle-grid">
            {follows.map((pk, i) => {
              const fp = profiles?.[pk] || {};
              const fn = displayName(pk, profiles);
              return (
                <div className="circle-card" key={pk} style={{ animationDelay: `${i * 0.04}s` }} onClick={() => onOpenProfile?.(pk)}>
                  <div className="circle-card-inner">
                    <div className="circle-card-av">
                      {fp.picture
                        ? <img src={fp.picture} alt={fn} onError={e => { e.target.style.display = "none"; }} />
                        : fn[0]?.toUpperCase()}
                    </div>
                    <div className="circle-card-info">
                      <div className="circle-card-name">{fn}</div>
                      {fp.nip05 && <div className="circle-card-nip05"><Ck s={8} />{fp.nip05}</div>}
                      {fp.about && <div className="circle-card-about">{fp.about}</div>}
                      <div className="circle-card-npub">{shortNpub(pk)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Notes tab */}
      {tab === "notes" && (
        topLevel.length === 0
          ? <div className="empty-state"><div className="empty-state-title">No notes yet</div><div className="empty-state-sub">Notes, reposts, and quote reposts will appear here</div></div>
          : topLevel.sort((a, b) => b.created_at - a.created_at).map((e, i) => {
              const isRepost      = e.kind === 6;
              const isQuote       = isQuoteRepost(e);
              const threadId      = threadTargetId(e);
              let repostedEvent   = threadId ? mergedEvents.find(ev => ev.id === threadId) : null;
              if (!repostedEvent && isRepost && threadId) {
                const emb = parseKind6EmbeddedEvent(e);
                if (emb?.id === threadId) repostedEvent = emb;
              }
              const displayPk     = isRepost && repostedEvent ? repostedEvent.pubkey : e.pubkey;
              const displayEv     = isRepost && repostedEvent ? repostedEvent : e;

              return (
                <div className="note-card" key={e.id} style={{ animationDelay: `${i * 0.04}s` }}
                  onClick={() => onOpenThread?.(isRepost && repostedEvent ? repostedEvent : e)}>
                  {isRepost && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-faint)", marginBottom: 8, paddingLeft: 2 }}>
                      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
                      <span style={{ cursor: "pointer", fontWeight: 500 }} onClick={e2 => { e2.stopPropagation(); onOpenProfile?.(e.pubkey); }}>{displayName(e.pubkey, profiles)}</span>
                      &nbsp;reposted
                    </div>
                  )}
                  <div className="note-inner">
                    <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={e2 => { e2.stopPropagation(); onOpenProfile?.(displayPk); }}>
                      <Avatar pk={displayPk} profiles={profiles} size={36} />
                    </div>
                    <div className="note-body">
                      <button
                        type="button"
                        className="note-card-menu-btn"
                        onClick={e2 => { e2.stopPropagation(); setProfileNotesMenuId(id => (id === e.id ? null : e.id)); }}
                        aria-label="More options"
                      >
                        <span />
                        <span />
                        <span />
                      </button>
                      {profileNotesMenuId === e.id && (
                        <div className="note-card-menu" onClick={e2 => e2.stopPropagation()}>
                          <button
                            className="note-card-menu-item"
                            onClick={() => {
                              navigator.clipboard?.writeText(e.content || "").catch(() => {});
                              setProfileNotesMenuId(null);
                            }}
                          >
                            Copy Note Text
                          </button>
                          <button
                            className="note-card-menu-item"
                            onClick={() => {
                              navigator.clipboard?.writeText(e.id || "").catch(() => {});
                              setProfileNotesMenuId(null);
                            }}
                          >
                            Copy Note ID
                          </button>
                          <button
                            className="note-card-menu-item"
                            onClick={() => {
                              setProfileNotesMenuId(null);
                              setProfileNotesJsonEvent(e);
                            }}
                          >
                            View JSON
                          </button>
                        </div>
                      )}
                      <div className="note-meta">
                        <span className="note-name" style={{ cursor: "pointer" }} onClick={e2 => { e2.stopPropagation(); onOpenProfile?.(displayPk); }}>
                          {displayName(displayPk, profiles)}
                        </span>
                        <span className="note-npub">{nip05OrNpub(displayPk, profiles)}</span>
                        <span className="meta-dot" aria-hidden="true">·</span>
                        <span className="note-time">{relativeTime(displayEv.created_at)}</span>
                      </div>
                      {isQuote && e.content && <NoteContent content={e.content.replace(/\nnostr:\S+/g, "").trim()} profiles={profiles} onOpenProfile={onOpenProfile} allEvents={mergedEvents} onOpenThread={onOpenThread} resolveEventById={resolveEventById} style={{ marginBottom: 8 }} />}
                      {isRepost && repostedEvent && <NoteContent content={repostedEvent.content} profiles={profiles} onOpenProfile={onOpenProfile} allEvents={mergedEvents} onOpenThread={onOpenThread} resolveEventById={resolveEventById} />}
                      {isRepost && !repostedEvent && <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-faint)" }}>Original note not in feed</p>}
                      {!isRepost && !isQuote && <NoteContent content={e.content} profiles={profiles} onOpenProfile={onOpenProfile} allEvents={mergedEvents} onOpenThread={onOpenThread} resolveEventById={resolveEventById} />}
                      {isQuote && (
                        repostedEvent ? (
                          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", background: "var(--surface)", marginBottom: 4, cursor: "pointer" }}
                            onClick={e2 => { e2.stopPropagation(); onOpenThread?.(repostedEvent); }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                              <Avatar pk={repostedEvent.pubkey} profiles={profiles} size={20} />
                              <span style={{ fontSize: 12, fontWeight: 500, cursor: "pointer" }} onClick={e2 => { e2.stopPropagation(); onOpenProfile?.(repostedEvent.pubkey); }}>{displayName(repostedEvent.pubkey, profiles)}</span>
                              <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto" }}>{relativeTime(repostedEvent.created_at)}</span>
                            </div>
                            <div style={{ maxHeight: 220, overflow: "hidden" }}>
                              <NoteContent content={repostedEvent.content} profiles={profiles} onOpenProfile={onOpenProfile} allEvents={mergedEvents} onOpenThread={onOpenThread} resolveEventById={resolveEventById} className="note-text" style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-muted)", margin: 0 }} />
                            </div>
                          </div>
                        ) : (
                          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", background: "var(--surface)", fontSize: 12, color: "var(--text-faint)", fontStyle: "italic" }}>Note not in feed</div>
                        )
                      )}
                      <NoteActions
                        event={isRepost && repostedEvent ? repostedEvent : e}
                        profiles={profiles} myPubkey={myPubkey} myProfile={myProfile} events={mergedEvents}
                        onOpenThread={onOpenThread} onOpenZaps={onOpenZaps}
                        onOpenReactions={onOpenReactions} onOpenReposts={onOpenReposts}
                        onPublish={onPublish} publishEvent={publishEvent} onPrepend={onPrepend}
                        onBookmark={onBookmark} isBookmarked={isBookmarked}
                        getLocalZaps={getLocalZaps} addLocalZap={addLocalZap}
                        getLocalReactions={getLocalReactions} setLocalReaction={setLocalReaction}
                        onRequestModal={onRequestModal} onDismissModal={onDismissModal}
                      />
                    </div>
                  </div>
                </div>
              );
            })
      )}

      {/* Replies tab */}
      {tab === "replies" && (
        replies.length === 0
          ? <div className="empty-state"><div className="empty-state-title">No replies yet</div><div className="empty-state-sub">Replies to other notes will appear here</div></div>
          : replies.map((e, i) => {
              const parentId = directReplyParentId(e);
              const parentEv = parentId ? mergedEvents.find(ev => ev.id === parentId) : null;
              let replyingToPk = parentEv?.pubkey ?? null;
              if (!replyingToPk && e.tags?.length) {
                const ps = e.tags.filter(t => t[0] === "p" && t[1]).map(t => t[1]);
                replyingToPk = ps.find(pk => pk !== e.pubkey) ?? ps[0] ?? null;
              }
              return (
                <NoteCard key={e.id} event={e} profiles={profiles}
                  events={mergedEvents}
                  resolveEventById={resolveEventById}
                  replyingToPubkey={replyingToPk}
                  liked={false} bookmarked={isBookmarked?.(e) || false} likeCount={0}
                  replyCount={replyCount(e.id, mergedEvents)} repostCount={repostAndQuoteCount(e.id, mergedEvents)}
                  myPubkey={myPubkey} myProfile={myProfile}
                  onLike={() => {}} onBookmark={onBookmark}
                  onOpenProfile={onOpenProfile} onOpenThread={onOpenThread}
                  onOpenZaps={onOpenZaps} onOpenReactions={onOpenReactions} onOpenReposts={onOpenReposts}
                  onPublish={onPublish} publishEvent={publishEvent} onPrepend={onPrepend}
                  getLocalZaps={getLocalZaps} addLocalZap={addLocalZap}
                  getLocalReactions={getLocalReactions} setLocalReaction={setLocalReaction}
                  delay={i * 0.04}
                />
              );
            })
      )}

      {profileNotesJsonEvent && createPortal(
        <div className="overlay centered profile-json-overlay" onClick={() => setProfileNotesJsonEvent(null)}>
          <div className="note-json-modal" onClick={ev => ev.stopPropagation()}>
            <div className="note-json-header">
              <div className="note-json-title">Event JSON</div>
              <button type="button" className="note-json-close" onClick={() => setProfileNotesJsonEvent(null)} aria-label="Close">×</button>
            </div>
            <div className="note-json-pre-wrap">
              <button
                type="button"
                className="note-json-copy"
                onClick={ev => {
                  ev.stopPropagation();
                  navigator.clipboard?.writeText(JSON.stringify(profileNotesJsonEvent, null, 2)).catch(() => {});
                  setProfileNotesJsonCopied(true);
                  setTimeout(() => setProfileNotesJsonCopied(false), 1200);
                }}
                aria-label="Copy JSON"
              >
                {profileNotesJsonCopied ? "✓" : "⧉"}
              </button>
              <pre className="note-json-pre">{JSON.stringify(profileNotesJsonEvent, null, 2)}</pre>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Between us tab */}
      {tab === "between" && !isOwn && (
        ixLoading && betweenUs.length === 0
          ? <div className="empty-state"><div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-faint)", fontSize: 13 }}><div style={{ width: 14, height: 14, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />Loading exchanges…</div></div>
          : betweenUs.length === 0
            ? <div className="empty-state"><div className="empty-state-title">Nothing yet</div><div className="empty-state-sub">Replies and mentions between you and {name} will appear here</div></div>
            : betweenUs.map((e, i) => (
                <IxNote
                  key={e.id}
                  event={e}
                  myPubkey={myPubkey}
                  profiles={profiles}
                  onOpenProfile={onOpenProfile}
                  onOpenThread={onOpenThread}
                  resolveEventById={resolveEventById}
                  allEvents={allEvents}
                  delay={i * 0.04}
                />
              ))
      )}
    </div>
  );
}
