import { useState, useEffect, useMemo, useRef, useCallback, useTransition } from "react";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import NoteCard from "./NoteCard.jsx";
import PollCard from "./PollCard.jsx";
import NoteActions from "./NoteActions.jsx";
import ProfileText from "./ProfileText.jsx";
import { Bk, Ck } from "./icons.jsx";
import { displayName, nip05OrNpub, relativeTime, shortNpub, truncNpub, avatarUrl, isQuoteRepost, isHexPubkey, replyCount, repostAndQuoteCount, normPubkey, directReplyParentId, parseKind6EmbeddedEvent, nip19, parseNoteMediaSegments } from "../utils.js";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import useInteractions from "../hooks/useInteractions.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";
import SkelCard from "./SkelCard.jsx";
import ProfileMediaGrid from "./ProfileMediaGrid.jsx";
import LongformCard from "./LongformCard.jsx";
import CalendarCard from "./CalendarCard.jsx";
import StreamCard from "./StreamCard.jsx";
import useActiveStream from "../hooks/useActiveStream.js";

// Persists across component mounts so returning to a profile doesn't refetch
const mediaCache = new Map(); // pubkey → { items, until, exhausted }

const hasNonMentionETag = e => e.tags.some(t => t[0] === "e" && t[3] !== "mention");
const isReplyEvent = e => e.kind === 1 && hasNonMentionETag(e) && !isQuoteRepost(e);

function NpubCopy({ pubkey }) {
  const [copied, setCopied] = useState(false);
  const npub      = nip19.npubEncode(pubkey);
  const truncated = truncNpub(pubkey);

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

function LightningCopy({ address }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = e => {
    e.stopPropagation();
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="profile-npub">
      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth={2} style={{ flexShrink: 0 }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
      <span style={{ marginLeft: 3 }}>{address}</span>
      <button onClick={handleCopy} style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 3px", color: copied ? "var(--primary)" : "var(--text-faint)", transition: "color .2s", display: "flex", alignItems: "center" }}>
        {copied
          ? <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12" /></svg>
          : <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
        }
      </button>
    </div>
  );
}

function normalizeWebsite(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  const raw = url.trim();
  const href = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
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
  onBack, onOpenProfile, onOpenNote, onOpenThread, onOpenHashtag, onOpenZaps, onOpenReactions, onOpenReposts,
  myProfile, onPublish, publishEvent, onPrepend, onBookmark, isBookmarked,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  onRequestModal, onDismissModal, backLabel = "Your Circle", resolveEventById,
  onOpenCircle, onFollow, onUnfollow, onOpenPollVotes, onOpenArticle, onOpenCalendarEvent, onOpenStream,
  sendZap, defaultZapAmount, defaultZapMsg, onZapFail,
}) {
  const [tab, setTab] = useState("notes");             // drives indicator immediately
  const [renderedTab, setRenderedTab] = useState("notes"); // drives content (deferred)
  const [, startTransition] = useTransition();

  const switchTab = useCallback((newTab) => {
    setTab(newTab);                                    // instant: tab highlight
    startTransition(() => setRenderedTab(newTab));     // deferred: render content
  }, []);

  const [visibleNotes, setVisibleNotes] = useState(20);
  const [visibleReplies, setVisibleReplies] = useState(20);
  const [visibleArticles, setVisibleArticles] = useState(10);
  const [profileEvents, setProfileEvents] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [subjectFollows, setSubjectFollows] = useState([]);
  const [circleLoading, setCircleLoading] = useState(true);
  const [profileNotesMenuId, setProfileNotesMenuId] = useState(null);
  const [profileNotesJsonEvent, setProfileNotesJsonEvent] = useState(null);

  const [mediaItems, setMediaItems] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaExhausted, setMediaExhausted] = useState(false);
  const mediaUntilRef = useRef(null);
  const mediaFetchingRef = useRef(false);
  const mediaExhaustedRef = useRef(false);
  const mediaStartedRef = useRef(false);
  const { stream: activeStream } = useActiveStream(pubkey);

  const p    = profiles?.[pubkey] || {};
  const name = displayName(pubkey, profiles);
  const websiteHref = normalizeWebsite(p.website);
  const websiteLabel = websiteHref ? websiteHref.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";

  const { extras, loading: ixLoading } = useInteractions({ myPubkey, otherPubkey: pubkey, feedEvents: events });

  const [repostExtras, setRepostExtras] = useState({});
  const repostFetchRef = useRef(new Set());
  const [parentEvents, setParentEvents] = useState({});
  const parentFetchRef = useRef(new Set());

  useEffect(() => {
    setProfileNotesMenuId(null);
    setProfileNotesJsonEvent(null);
  }, [renderedTab, pubkey]);

  useEffect(() => {
    setVisibleNotes(20);
    setVisibleReplies(20);
    setVisibleArticles(10);
    setRenderedTab("notes");
    setTab("notes");
  }, [pubkey]);

  useEffect(() => {
    setRepostExtras({});
    repostFetchRef.current.clear();
    setParentEvents({});
    parentFetchRef.current.clear();

    mediaFetchingRef.current = false;
    const cached = mediaCache.get(pubkey);
    if (cached) {
      setMediaItems(cached.items);
      setMediaExhausted(cached.exhausted);
      setMediaLoading(false);
      mediaUntilRef.current = cached.until;
      mediaExhaustedRef.current = cached.exhausted;
      mediaStartedRef.current = true;
    } else {
      setMediaItems([]);
      setMediaLoading(false);
      setMediaExhausted(false);
      mediaUntilRef.current = null;
      mediaExhaustedRef.current = false;
      mediaStartedRef.current = false;
    }
  }, [pubkey]);

  const fetchMediaBatch = useCallback(() => {
    if (mediaFetchingRef.current || mediaExhaustedRef.current) return;
    mediaFetchingRef.current = true;
    setMediaLoading(true);

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    const filter = { kinds: [1], authors: [pubkey], limit: 100 };
    if (mediaUntilRef.current) filter.until = mediaUntilRef.current;

    const batch = [];
    pool.request(relayUrls, [filter]).subscribe({
      next: raw => batch.push(raw),
      complete: () => {
        const newItems = [];
        for (const ev of batch) {
          const segs = parseNoteMediaSegments(ev.content || "");
          const media = segs.filter(s => s.type === "image" || s.type === "video");
          if (media.length) newItems.push({ event: ev, url: media[0].url, type: media[0].type, count: media.length });
        }
        newItems.sort((a, b) => b.event.created_at - a.event.created_at);

        const isExhausted = batch.length < 100;
        mediaUntilRef.current = batch.length ? Math.min(...batch.map(e => e.created_at)) - 1 : null;
        mediaFetchingRef.current = false;
        mediaExhaustedRef.current = isExhausted;

        setMediaItems(prev => {
          const seen = new Set(prev.map(i => i.event.id));
          const merged = [...prev, ...newItems.filter(i => !seen.has(i.event.id))];
          mediaCache.set(pubkey, { items: merged, until: mediaUntilRef.current, exhausted: isExhausted });
          return merged;
        });
        setMediaExhausted(isExhausted);
        setMediaLoading(false);
      },
      error: () => {
        mediaFetchingRef.current = false;
        setMediaLoading(false);
      },
    });
  }, [pubkey]);

  useEffect(() => {
    if (renderedTab !== "media" || mediaStartedRef.current) return;
    mediaStartedRef.current = true;
    fetchMediaBatch();
  }, [renderedTab, fetchMediaBatch]);

  // Scroll the tab bar into view when switching between text tabs.
  // Skipped for any transition involving the media tab because the grid's
  // display:none toggle collapses layout height right before the scroll fires,
  // making it look like a full page reload.
  const tabBarRef = useRef(null);
  const prevTabRef = useRef(tab);
  useEffect(() => {
    const prev = prevTabRef.current;
    prevTabRef.current = tab;
    if (prev !== "media" && tab !== "media") {
      tabBarRef.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
    }
  }, [tab]);

  // Stable refs so the scroll handler never needs to be recreated
  const renderedTabRef = useRef(renderedTab);
  const topLevelLenRef = useRef(0);
  const repliesLenRef  = useRef(0);
  const articlesLenRef = useRef(0);
  useEffect(() => { renderedTabRef.current = renderedTab; }, [renderedTab]);

  const handleProfileScroll = useCallback(e => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 300) return;
    if (renderedTabRef.current === "notes")
      setVisibleNotes(n => Math.min(n + 20, topLevelLenRef.current));
    else if (renderedTabRef.current === "replies")
      setVisibleReplies(n => Math.min(n + 20, repliesLenRef.current));
    else if (renderedTabRef.current === "articles")
      setVisibleArticles(n => Math.min(n + 10, articlesLenRef.current));
  }, []);

  useEffect(() => {
    if (!pubkey) return;

    let cancelled = false;
    const activeSubs = [];
    setProfileEvents([]);
    setProfileLoading(true);
    setCircleLoading(!isOwn);

    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    const byId = new Map();

    const flush = () => {
      if (!cancelled) setProfileEvents(Array.from(byId.values()).sort((a, b) => b.created_at - a.created_at));
    };

    // Phase 1 — notes first (default tab); clears loading state when done
    const notesSub = pool.request(relayUrls, [{ kinds: [1], authors: [pubkey], limit: 200 }]).subscribe({
      next: raw => { eventStore.add(raw); byId.set(raw.id, raw); },
      complete: () => { flush(); if (!cancelled) setProfileLoading(false); },
      error:    () => { if (!cancelled) setProfileLoading(false); },
    });
    activeSubs.push(notesSub);

    // Phase 2 — reposts, polls, and calendar events in parallel; merges into same byId
    const otherSub = pool.request(relayUrls, [{ kinds: [6, 1068, 6969, 31922, 31923, 30311], authors: [pubkey], limit: 100 }]).subscribe({
      next: raw => { eventStore.add(raw); byId.set(raw.id, raw); },
      complete: flush,
    });
    activeSubs.push(otherSub);

    // Phase 3 — articles get their own budget so a large repost count can't crowd them out
    const articlesSub = pool.request(relayUrls, [{ kinds: [30023], authors: [pubkey], limit: 100 }]).subscribe({
      next: raw => { eventStore.add(raw); byId.set(raw.id, raw); },
      complete: flush,
    });
    activeSubs.push(articlesSub);

    // Fetch subject's contact list for circle count (skip for own profile)
    if (!isOwn) {
      const followsSub = pool.request(relayUrls, [{ kinds: [3], authors: [pubkey], limit: 1 }]).subscribe({
        next: raw => {
          if (cancelled) return;
          const pks = raw.tags.filter(t => t[0] === "p" && isHexPubkey(t[1])).map(t => t[1]);
          setSubjectFollows(pks);
        },
        complete: () => { if (!cancelled) setCircleLoading(false); },
        error:    () => { if (!cancelled) setCircleLoading(false); },
      });
      activeSubs.push(followsSub);
    }

    return () => {
      cancelled = true;
      for (const sub of activeSubs) { try { sub.unsubscribe(); } catch {} }
    };
  }, [pubkey, isOwn]);

  const mergedEvents = useMemo(() => {
    const byId = new Map();
    for (const e of events || []) byId.set(e.id, e);
    for (const e of profileEvents || []) byId.set(e.id, e);
    for (const e of Object.values(repostExtras)) byId.set(e.id, e);
    return Array.from(byId.values());
  }, [events, profileEvents, repostExtras]);

  const theirEvents = useMemo(
    () => mergedEvents.filter(e => e.pubkey === pubkey && (e.kind === 1 || e.kind === 6 || e.kind === 1068 || e.kind === 6969 || e.kind === 31922 || e.kind === 31923 || e.kind === 30311)),
    [mergedEvents, pubkey]
  );

  const topLevel = useMemo(
    () => theirEvents
      .filter(e => e.kind === 6 || isQuoteRepost(e) || (e.kind === 1 && !hasNonMentionETag(e)) || e.kind === 1068 || e.kind === 6969 || e.kind === 31922 || e.kind === 31923 || e.kind === 30311)
      .sort((a, b) => b.created_at - a.created_at),
    [theirEvents]
  );

  const replies = useMemo(
    () => theirEvents.filter(isReplyEvent).sort((a, b) => b.created_at - a.created_at),
    [theirEvents]
  );

  const articles = useMemo(
    () => mergedEvents
      .filter(e => e.pubkey === pubkey && e.kind === 30023)
      .sort((a, b) => b.created_at - a.created_at),
    [mergedEvents, pubkey]
  );

  useEffect(() => { topLevelLenRef.current  = topLevel.length;  }, [topLevel.length]);
  useEffect(() => { repliesLenRef.current   = replies.length;   }, [replies.length]);
  useEffect(() => { articlesLenRef.current  = articles.length;  }, [articles.length]);

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

  useEffect(() => {
    if (!resolveEventById) return;
    let cancelled = false;
    for (const e of replies) {
      const parentId = directReplyParentId(e);
      if (!parentId) continue;
      if (mergedEvents.some(ev => ev.id === parentId)) continue;
      if (parentEvents[parentId]) continue;
      if (parentFetchRef.current.has(parentId)) continue;
      parentFetchRef.current.add(parentId);
      resolveEventById(parentId).then(ev => {
        parentFetchRef.current.delete(parentId);
        if (cancelled || !ev?.id) return;
        setParentEvents(prev => (prev[ev.id] ? prev : { ...prev, [ev.id]: ev }));
      }).catch(() => { parentFetchRef.current.delete(parentId); });
    }
    return () => { cancelled = true; };
  }, [replies, mergedEvents, resolveEventById]);

  const allEvents = useMemo(() => [...mergedEvents, ...extras], [mergedEvents, extras]);

  const betweenUs = useMemo(
    () => allEvents
      .filter(e => {
        if (e.kind !== 1) return false;
        const pTags = e.tags.filter(t => t[0] === "p").map(t => t[1]);
        return (e.pubkey === pubkey && pTags.includes(myPubkey)) ||
               (e.pubkey === myPubkey && pTags.includes(pubkey));
      })
      .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
      .sort((a, b) => a.created_at - b.created_at),
    [allEvents, pubkey, myPubkey]
  );

  return (
    <div className="slide-panel-scroll" onScroll={handleProfileScroll}>
      <div className="profile-banner" style={{ position: "relative" }}>
        {p.banner ? (
          <>
            <img className="profile-banner-image" src={p.banner} alt="" onError={e => { e.target.style.display = "none"; }} />
            <div className="profile-banner-overlay" />
          </>
        ) : (
          <div className="profile-banner-glyph">◎</div>
        )}
        <button className="back-btn" onClick={onBack} style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,.25)", backdropFilter: "blur(8px)", color: "white" }}>
          <Bk s={16} />
        </button>
      </div>

      <div className="profile-identity" style={{ paddingBottom: 16 }}>
        <div className="profile-av-wrap">
          <div
            className={`profile-av${activeStream ? " profile-av-live" : ""}`}
            onClick={activeStream ? () => onOpenStream?.(activeStream) : undefined}
            style={activeStream ? { cursor: "pointer" } : undefined}
          >
            {p.picture
              ? <img src={p.picture} alt={name} onError={e => { e.target.style.display = "none"; }} />
              : name[0]?.toUpperCase()}
            {activeStream && <div className="profile-av-live-badge">LIVE</div>}
          </div>
          {isOwn && <button className="profile-edit-btn">Edit profile</button>}
          {!isOwn && (
            follows?.includes(pubkey)
              ? <button className="profile-unfollow-btn" onClick={() => onUnfollow?.(pubkey)}>Unfollow</button>
              : <button className="profile-follow-btn"  onClick={() => onFollow?.(pubkey)}>Follow</button>
          )}
        </div>
        <div className="profile-name">{name}</div>
        {p.nip05 && <div className="profile-nip05">{p.nip05}</div>}
        <NpubCopy pubkey={pubkey} />
        {(p.lud16 || p.lud06) && <LightningCopy address={p.lud16 || p.lud06} />}
        {(() => {
          const circleFollows = isOwn ? follows : subjectFollows;
          if (circleLoading || circleFollows.length === 0) return null;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <button
                onClick={() => !circleLoading && onOpenCircle?.({ pubkey, follows: circleFollows })}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: "none", border: "none", padding: "2px 0",
                  cursor: circleLoading ? "default" : "pointer", color: "var(--primary)",
                  fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
                }}
              >
                <div style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, ...(circleLoading ? { border: "1.5px solid var(--primary-soft)", borderTopColor: "var(--primary)", animation: "spin .7s linear infinite" } : { border: "1.5px solid var(--primary)" }) }} />
                {!circleLoading && circleFollows.length > 0 && circleFollows.length}
              </button>
              {!isOwn && subjectFollows.includes(myPubkey) && (
                <div className="profile-follows-you">follows you</div>
              )}
            </div>
          );
        })()}
        {p.about && <ProfileText className="profile-about" text={p.about} />}
        {websiteHref && (
          <a
            className="profile-website"
            href={websiteHref}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
          >
            {websiteLabel}
          </a>
        )}
      </div>

      <div className="profile-stats" ref={tabBarRef}>
        <div className={`profile-stat ${tab === "notes" ? "active" : ""}`} onClick={() => switchTab("notes")}>
          <div className="profile-stat-label">Notes</div>
        </div>
        <div className={`profile-stat ${tab === "replies" ? "active" : ""}`} onClick={() => switchTab("replies")}>
          <div className="profile-stat-label">Replies</div>
        </div>
        <div className={`profile-stat ${tab === "media" ? "active" : ""}`} onClick={() => switchTab("media")}>
          <div className="profile-stat-label">Media</div>
        </div>
        <div className={`profile-stat ${tab === "articles" ? "active" : ""}`} onClick={() => switchTab("articles")}>
          <div className="profile-stat-label">Articles</div>
        </div>
        {!isOwn && (
          <div className={`profile-stat ${tab === "between" ? "active" : ""}`} onClick={() => switchTab("between")}>
            <div className="profile-stat-label">Between us</div>
          </div>
        )}
      </div>

      {/* Notes tab */}
      {renderedTab === "notes" && (
        profileLoading && topLevel.length === 0
          ? [0, 1, 2].map(i => <SkelCard key={i} />)
          : topLevel.length === 0
            ? <div className="empty-state"><div className="empty-state-title">No notes yet</div><div className="empty-state-sub">Notes, reposts, and quote reposts will appear here</div></div>
            : topLevel.slice(0, visibleNotes).map((e, i) => {
              if (e.kind === 31922 || e.kind === 31923) {
                return (
                  <CalendarCard
                    key={e.id}
                    event={e}
                    profiles={profiles}
                    liked={false}
                    bookmarked={isBookmarked?.(e) || false}
                    likeCount={0}
                    onLike={() => {}}
                    onBookmark={onBookmark}
                    onOpen={onOpenCalendarEvent}
                    onOpenProfile={onOpenProfile}
                    delay={0}
                  />
                );
              }
              if (e.kind === 30311) {
                return (
                  <StreamCard
                    key={e.id}
                    event={e}
                    profiles={profiles}
                    liked={false}
                    bookmarked={isBookmarked?.(e) || false}
                    likeCount={0}
                    onLike={() => {}}
                    onBookmark={onBookmark}
                    onOpen={onOpenStream}
                    onOpenProfile={onOpenProfile}
                    delay={0}
                  />
                );
              }
              if (e.kind === 1068 || e.kind === 6969) {
                return (
                  <PollCard
                    key={e.id}
                    event={e}
                    events={mergedEvents}
                    resolveEventById={resolveEventById}
                    profiles={profiles}
                    myPubkey={myPubkey}
                    myProfile={myProfile}
                    onOpenProfile={onOpenProfile}
                    onOpenThread={onOpenThread}
                    onOpenHashtag={onOpenHashtag}
                    onOpenZaps={onOpenZaps}
                    onOpenReactions={onOpenReactions}
                    onOpenReposts={onOpenReposts}
                    onPublish={onPublish}
                    publishEvent={publishEvent}
                    onPrepend={onPrepend}
                    getLocalZaps={getLocalZaps}
                    addLocalZap={addLocalZap}
                    getLocalReactions={getLocalReactions}
                    setLocalReaction={setLocalReaction}
                    onRequestModal={onRequestModal}
                    onDismissModal={onDismissModal}
                    sendZap={sendZap}
                    defaultZapAmount={defaultZapAmount}
                    defaultZapMsg={defaultZapMsg}
                    onZapFail={onZapFail}
                    onOpenVotes={onOpenPollVotes}
                    delay={0}
                  />
                );
              }
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
                <div className="note-card" key={e.id}
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
                        <NoteContextMenu
                          event={e}
                          onClose={() => setProfileNotesMenuId(null)}
                          onViewJson={setProfileNotesJsonEvent}
                        />
                      )}
                      <div className="note-meta">
                        <span className="note-name" style={{ cursor: "pointer" }} onClick={e2 => { e2.stopPropagation(); onOpenProfile?.(displayPk); }}>
                          {displayName(displayPk, profiles)}
                        </span>
                        <span className="note-npub">{nip05OrNpub(displayPk, profiles)}</span>
                        <span className="meta-dot" aria-hidden="true">·</span>
                        <span className="note-time">{relativeTime(displayEv.created_at)}</span>
                      </div>
                      {isQuote && e.content && <NoteContent content={e.content.replace(/\nnostr:\S+/g, "").trim()} profiles={profiles} onOpenProfile={onOpenProfile} onOpenHashtag={onOpenHashtag} allEvents={mergedEvents} onOpenThread={onOpenThread} resolveEventById={resolveEventById} style={{ marginBottom: 8 }} collapsible />}
                      {isRepost && repostedEvent && <NoteContent content={repostedEvent.content} profiles={profiles} onOpenProfile={onOpenProfile} onOpenHashtag={onOpenHashtag} allEvents={mergedEvents} onOpenThread={onOpenThread} resolveEventById={resolveEventById} collapsible />}
                      {isRepost && !repostedEvent && <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-faint)" }}>Original note not in feed</p>}
                      {!isRepost && !isQuote && <NoteContent content={e.content} profiles={profiles} onOpenProfile={onOpenProfile} onOpenHashtag={onOpenHashtag} allEvents={mergedEvents} onOpenThread={onOpenThread} resolveEventById={resolveEventById} collapsible />}
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
                              <NoteContent content={repostedEvent.content} profiles={profiles} onOpenProfile={onOpenProfile} onOpenHashtag={onOpenHashtag} allEvents={mergedEvents} onOpenThread={onOpenThread} resolveEventById={resolveEventById} className="note-text" style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-muted)", margin: 0 }} />
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
                        sendZap={sendZap} defaultZapAmount={defaultZapAmount}
                        defaultZapMsg={defaultZapMsg} onZapFail={onZapFail}
                      />
                    </div>
                  </div>
                </div>
              );
            })
      )}

      {/* Replies tab */}
      {renderedTab === "replies" && (
        profileLoading && replies.length === 0
          ? [0, 1, 2].map(i => <SkelCard key={i} />)
          : replies.length === 0
            ? <div className="empty-state"><div className="empty-state-title">No replies yet</div><div className="empty-state-sub">Replies to other notes will appear here</div></div>
            : replies.slice(0, visibleReplies).map((e, i) => {
              const parentId = directReplyParentId(e);
              const parentEv = parentId
                ? (mergedEvents.find(ev => ev.id === parentId) ?? parentEvents[parentId] ?? null)
                : null;
              const replyingToPk = parentEv?.pubkey ?? null;
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
                  sendZap={sendZap} defaultZapAmount={defaultZapAmount}
                  defaultZapMsg={defaultZapMsg} onZapFail={onZapFail}
                  delay={0}
                />
              );
            })
      )}

      {/* Articles tab */}
      {renderedTab === "articles" && (
        profileLoading && articles.length === 0
          ? [0, 1, 2].map(i => <SkelCard key={i} />)
          : articles.length === 0
            ? <div className="empty-state"><div className="empty-state-title">No articles yet</div><div className="empty-state-sub">Long-form posts will appear here</div></div>
            : articles.slice(0, visibleArticles).map(e => (
                <LongformCard
                  key={e.id}
                  event={e}
                  profiles={profiles}
                  liked={false}
                  bookmarked={isBookmarked?.(e) || false}
                  likeCount={0}
                  onLike={() => {}}
                  onBookmark={onBookmark}
                  onOpen={onOpenArticle}
                  onOpenProfile={onOpenProfile}
                  delay={0}
                />
              ))
      )}

      {/* Media tab — always mounted so thumbnail images stay in DOM across tab switches */}
      <ProfileMediaGrid
        visible={renderedTab === "media"}
        items={mediaItems}
        loading={mediaLoading}
        exhausted={mediaExhausted}
        onLoadMore={fetchMediaBatch}
        onOpenThread={onOpenThread}
      />

      {profileNotesJsonEvent && <NoteJsonModal event={profileNotesJsonEvent} onClose={() => setProfileNotesJsonEvent(null)} />}

      {/* Between us tab */}
      {renderedTab === "between" && !isOwn && (
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
                  delay={0}
                />
              ))
      )}
    </div>
  );
}
