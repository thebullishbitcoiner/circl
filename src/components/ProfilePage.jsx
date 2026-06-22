import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import NoteCard from "./NoteCard.jsx";
import PollCard from "./PollCard.jsx";
import NoteActions from "./NoteActions.jsx";
import ProfileText from "./ProfileText.jsx";
import { Bk, Ck } from "./icons.jsx";
import ProfileContextMenu from "./ProfileContextMenu.jsx";
import { displayName, nip05OrNpub, relativeTime, shortNpub, truncNpub, avatarUrl, isQuoteRepost, isHexPubkey, replyCount, repostAndQuoteCount, normPubkey, directReplyParentId, parseKind6EmbeddedEvent, nip19, parseNoteMediaSegments, zapperPubkeyFromKind9735 } from "../utils.js";
import useProfiles from "../hooks/useProfiles.js";
import NoteContextMenu from "./NoteContextMenu.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import useInteractions from "../hooks/useInteractions.js";
import { useNavigation } from "../context/NavigationContext.jsx";
import { pool, eventStore, validRelays } from "../nostr.js";
import { RELAYS } from "../constants.js";
import useMailboxes from "../hooks/useMailboxes.js";
import SkelCard from "./SkelCard.jsx";
import ProfileMediaGrid from "./ProfileMediaGrid.jsx";
import MediaLightbox from "./MediaLightbox.jsx";
import LongformCard from "./LongformCard.jsx";
import CalendarCard from "./CalendarCard.jsx";
import FeedItem from "./FeedItem.jsx";
import StreamCard from "./StreamCard.jsx";
import HighlightCard from "./HighlightCard.jsx";
import PollInline from "./PollInline.jsx";
import useActiveStream from "../hooks/useActiveStream.js";
import ListingCard from "./ListingCard.jsx";
import ListingDetail from "./ListingDetail.jsx";
import CreateListingSheet from "./CreateListingSheet.jsx";
import BadgeCard from "./BadgeCard.jsx";
import BadgeDetail from "./BadgeDetail.jsx";

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
    <div className="ix-note" style={{ animationDelay: `${delay}s`, cursor: "pointer" }} onClick={() => onOpenThread?.(event)}>
      <div className="ix-inner">
        <div className="ix-line-wrap">
          <div className={`ix-av ${isMe ? "is-me" : ""}`} style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>
            {url ? <img src={url} alt={init} onError={e => { e.target.style.display = "none"; }} /> : init}
          </div>
        </div>
        <div className="ix-body">
          <div className="ix-meta">
            <span className={`ix-name ${isMe ? "is-me" : ""}`} style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onOpenProfile?.(event.pubkey); }}>{name}</span>
            {isMe && <span className="ix-you-badge">you</span>}
            <span className="ix-time">{relativeTime(event.created_at)}</span>
          </div>
          {mentionedName && (
            <div className="ix-direction">
              replying to <span className="ix-mention" style={{ marginLeft: 3 }}>@{mentionedName}</span>
            </div>
          )}
          <NoteContent content={event.content} tags={event.tags} profiles={profiles} onOpenProfile={onOpenProfile} allEvents={allEvents} onOpenThread={onOpenThread} resolveEventById={resolveEventById} className="ix-text" />
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage({
  pubkey, myPubkey, profiles: profilesProp, follows, events, isOwn,
  onBack, onOpenProfile, onOpenNote, onOpenThread, onOpenHashtag, onOpenZaps, onOpenReactions, onOpenReposts,
  myProfile, onPublish, publishEvent, publishHighlight, onPrepend, onBookmark, isBookmarked,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  onRequestModal, onDismissModal, backLabel = "Your Circle", resolveEventById,
  onOpenCircle, onFollow, onUnfollow, onOpenPollVotes, onOpenArticle, onOpenStream,
  sendZap, defaultZapAmount, defaultZapMsg, onZapFail,
  scrollToTopTrigger,
  customEmojis,
  onEditProfile,
}) {
  const { isMuted } = useNavigation();

  const [tab, setTab] = useState("notes");

  const switchTab = useCallback((newTab) => {
    setTab(newTab);
  }, []);

  const [visibleNotes, setVisibleNotes] = useState(20);
  const [visibleReplies, setVisibleReplies] = useState(20);
  const [visibleArticles, setVisibleArticles] = useState(10);
  const [visibleHighlights, setVisibleHighlights] = useState(10);
  const [profileEvents, setProfileEvents] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [subjectFollows, setSubjectFollows] = useState([]);
  const [circleLoading, setCircleLoading] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileNotesMenuId, setProfileNotesMenuId] = useState(null);
  const [profileNotesJsonEvent, setProfileNotesJsonEvent] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const [articlesLoading, setArticlesLoading] = useState(true);
  const [highlightsLoading, setHighlightsLoading] = useState(true);
  const [articleEvents, setArticleEvents] = useState([]);
  const [highlightEventsList, setHighlightEventsList] = useState([]);

  const [mediaItems, setMediaItems] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaExhausted, setMediaExhausted] = useState(false);
  const [listingsLoading,  setListingsLoading]  = useState(false);
  const [listingEvents,    setListingEvents]    = useState([]);
  const [listingsSearch,   setListingsSearch]   = useState("");
  const [createListingOpen, setCreateListingOpen] = useState(false);
  const [selectedListing,  setSelectedListing]  = useState(null);

  const [profileBadges10008, setProfileBadges10008] = useState(null);
  const [acceptedPairs,      setAcceptedPairs]      = useState([]);   // [{aTag, eTag}]
  const [badgeDefMap,        setBadgeDefMap]        = useState(new Map());
  const [badgeAwardMap,      setBadgeAwardMap]      = useState(new Map()); // id → event
  const [allAwardEvents,     setAllAwardEvents]     = useState([]);   // all kind 8 received (own only)
  const [badgesLoading,      setBadgesLoading]      = useState(false);
  const [selectedBadge,      setSelectedBadge]      = useState(null);
  const [notAcceptedOpen,    setNotAcceptedOpen]    = useState(false);

  const handleBadgeAccept = async (awardEvent) => {
    const aTag = awardEvent.tags?.find(t => t[0] === "a")?.[1];
    if (!aTag) return;
    const pairTags = [];
    let i = 0;
    const existing = profileBadges10008?.tags || [];
    while (i < existing.length) {
      if (existing[i]?.[0] === "a" && existing[i + 1]?.[0] === "e") { pairTags.push(existing[i], existing[i + 1]); i += 2; }
      else { i++; }
    }
    const newEv = await publishEvent({ kind: 10008, content: "", tags: [...pairTags, ["a", aTag], ["e", awardEvent.id]] });
    if (!newEv) return;
    setProfileBadges10008(newEv);
    setAcceptedPairs(prev => [...prev, { aTag, eTag: awardEvent.id }]);
  };

  const handleBadgeRemove = async (awardId) => {
    const existing = profileBadges10008?.tags || [];
    const newTags = [];
    let i = 0;
    while (i < existing.length) {
      if (existing[i]?.[0] === "a" && existing[i + 1]?.[0] === "e") {
        if (existing[i + 1][1] !== awardId) newTags.push(existing[i], existing[i + 1]);
        i += 2;
      } else { i++; }
    }
    const newEv = await publishEvent({ kind: 10008, content: "", tags: newTags });
    if (!newEv) return;
    setProfileBadges10008(newEv);
    setAcceptedPairs(prev => prev.filter(p => p.eTag !== awardId));
    setSelectedBadge(null);
  };

  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollToTopTrigger > 0) scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [scrollToTopTrigger]);

  const mediaUntilRef = useRef(null);
  const mediaFetchingRef = useRef(false);
  const mediaExhaustedRef = useRef(false);
  const mediaStartedRef = useRef(false);
  const { stream: activeStream } = useActiveStream(pubkey);

  // NIP-65: fetch the profile's relay list so articles/highlights/listings can be
  // queried from the author's outbox relays, not just the user's connected relays.
  const { outboxes: profileOutboxes } = useMailboxes(pubkey);
  const contentRelayUrls = useMemo(() => {
    const base = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    if (!profileOutboxes?.length) return base;
    return [...new Set([...base, ...validRelays(profileOutboxes)])];
  }, [profileOutboxes]);
  const contentRelayKey = useMemo(() => contentRelayUrls.join(","), [contentRelayUrls]);

  const zapperPks = useMemo(() => {
    const pks = [];
    for (const e of profileEvents) {
      if (e.kind !== 9735) continue;
      const zapper = zapperPubkeyFromKind9735(e);
      if (zapper) pks.push(zapper);
      const Ptag = e.tags?.find(t => t[0] === "P")?.[1];
      if (Ptag) pks.push(Ptag);
    }
    return pks;
  }, [profileEvents]);
  const { profiles: zapperProfiles } = useProfiles({ pubkeys: zapperPks });
  const profiles = useMemo(() => ({ ...zapperProfiles, ...profilesProp }), [profilesProp, zapperProfiles]);

  const p    = profiles?.[pubkey] || {};
  const name = displayName(pubkey, profiles);
  const websiteHref = normalizeWebsite(p.website);
  const websiteLabel = websiteHref ? websiteHref.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";

  const { extras, loading: ixLoading } = useInteractions({ myPubkey, otherPubkey: pubkey, feedEvents: events, active: !isOwn && tab === "between" });

  const [repostExtras, setRepostExtras] = useState({});
  const repostFetchRef = useRef(new Set());
  const [parentEvents, setParentEvents] = useState({});
  const parentFetchRef = useRef(new Set());

  useEffect(() => {
    setProfileNotesMenuId(null);
    setProfileNotesJsonEvent(null);
  }, [tab, pubkey]);

  useEffect(() => {
    setVisibleNotes(20);
    setVisibleReplies(20);
    setVisibleArticles(10);
    setVisibleHighlights(10);
    setTab("notes");
    setArticlesLoading(true);
    setHighlightsLoading(true);
    setArticleEvents([]);
    setHighlightEventsList([]);
    setListingsLoading(true);
    setListingEvents([]);
    setListingsSearch("");
    setCreateListingOpen(false);
    setSelectedListing(null);
    setProfileBadges10008(null);
    setAcceptedPairs([]);
    setBadgeDefMap(new Map());
    setBadgeAwardMap(new Map());
    setAllAwardEvents([]);
    setBadgesLoading(false);
    setSelectedBadge(null);
    setNotAcceptedOpen(false);
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
    if (tab !== "media" || mediaStartedRef.current) return;
    mediaStartedRef.current = true;
    fetchMediaBatch();
  }, [tab, fetchMediaBatch]);

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
  const renderedTabRef = useRef(tab);
  const topLevelLenRef = useRef(0);
  const repliesLenRef  = useRef(0);
  const articlesLenRef = useRef(0);
  useEffect(() => { renderedTabRef.current = tab; }, [tab]);

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

    // Phase 1 — notes first (default tab); clears loading state when done.
    // Circle count fetch is deferred until after notes complete so the relay
    // prioritises the notes query and the tab populates without waiting for follows.
    const notesSub = pool.request(relayUrls, [{ kinds: [1], authors: [pubkey], limit: 200 }]).subscribe({
      next: raw => { eventStore.add(raw); byId.set(raw.id, raw); },
      complete: () => {
        flush();
        if (!cancelled) {
          setProfileLoading(false);
          // Start circle count only after notes are shown
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
        }
      },
      error: () => { if (!cancelled) setProfileLoading(false); },
    });
    activeSubs.push(notesSub);

    // Phase 2 — reposts, polls, calendar events, and streams in parallel; merges into same byId
    const otherSub = pool.request(relayUrls, [{ kinds: [6, 1068, 6969, 31922, 31923, 30311, 9735], authors: [pubkey], limit: 100 }]).subscribe({
      next: raw => { eventStore.add(raw); byId.set(raw.id, raw); },
      complete: flush,
    });
    activeSubs.push(otherSub);

    // Phase 3 — badges: fetch kind 10008 and deprecated kind 30008 (d=profile_badges) together.
    // Prefer kind 10008; fall back to 30008 for backwards compatibility.
    // On own profile also fetch all received kind 8 awards so unaccepted ones can be shown.
    setBadgesLoading(true);
    const badgesAccum = [];
    const badgesSub = pool.request(relayUrls, [
      { kinds: [10008], authors: [pubkey], limit: 1 },
      { kinds: [30008], authors: [pubkey], '#d': ['profile_badges'], limit: 1 },
    ]).subscribe({
      next: raw => {
        if (cancelled) return;
        eventStore.add(raw);
        if (!badgesAccum.some(e => e.id === raw.id)) badgesAccum.push(raw);
      },
      complete: () => {
        if (cancelled) return;

        // Prefer kind 10008; fall back to deprecated kind 30008 with d=profile_badges
        const chosen = badgesAccum.find(e => e.kind === 10008)
          || badgesAccum.find(e => e.kind === 30008 && e.tags?.find(t => t[0] === "d")?.[1] === "profile_badges");

        if (chosen) {
          setProfileBadges10008(chosen);

          // Parse consecutive (a, e) pairs
          const tags = chosen.tags || [];
          const pairs = [];
          let idx = 0;
          while (idx < tags.length) {
            if (tags[idx]?.[0] === "a" && tags[idx + 1]?.[0] === "e") {
              pairs.push({ aTag: tags[idx][1], eTag: tags[idx + 1][1] });
              idx += 2;
            } else {
              idx++;
            }
          }
          setAcceptedPairs(pairs);

          if (pairs.length) {
            // Fetch badge definitions for accepted a-tags
            const issuers = [...new Set(pairs.map(p => p.aTag.split(":")[1]).filter(Boolean))];
            if (issuers.length) {
              pool.request(relayUrls, [{ kinds: [30009], authors: issuers, limit: 200 }]).subscribe({
                next: def => {
                  if (cancelled) return;
                  eventStore.add(def);
                  const d = def.tags?.find(t => t[0] === "d")?.[1] || "";
                  setBadgeDefMap(m => new Map(m).set(`30009:${def.pubkey}:${d}`, def));
                },
                error: () => {},
              });
            }

            // Fetch the specific kind 8 award events referenced by accepted e-tags.
            // Also populate allAwardEvents (own profile) so that removing a badge from
            // the accepted list immediately surfaces it in the Received section.
            const awardIds = pairs.map(p => p.eTag).filter(Boolean);
            if (awardIds.length) {
              pool.request(relayUrls, [{ kinds: [8], ids: awardIds }]).subscribe({
                next: raw2 => {
                  if (cancelled) return;
                  eventStore.add(raw2);
                  setBadgeAwardMap(m => new Map(m).set(raw2.id, raw2));
                  if (isOwn) setAllAwardEvents(prev => prev.some(e => e.id === raw2.id) ? prev : [...prev, raw2]);
                },
                error: () => {},
              });
            }
          }
        }

        if (isOwn) {
          // Also fetch every kind 8 where we are a recipient so unaccepted awards are visible
          const allAccum = [];
          pool.request(relayUrls, [{ kinds: [8], '#p': [pubkey], limit: 100 }]).subscribe({
            next: raw => {
              if (cancelled) return;
              eventStore.add(raw);
              if (!allAccum.some(e => e.id === raw.id)) allAccum.push(raw);
              setBadgeAwardMap(m => new Map(m).set(raw.id, raw));
              setAllAwardEvents(prev => prev.some(e => e.id === raw.id) ? prev : [...prev, raw]);
            },
            complete: () => {
              if (cancelled) return;
              const issuers = [...new Set(allAccum.map(e => e.pubkey))];
              if (!issuers.length) { setBadgesLoading(false); return; }
              pool.request(relayUrls, [{ kinds: [30009], authors: issuers, limit: 200 }]).subscribe({
                next: def => {
                  if (cancelled) return;
                  eventStore.add(def);
                  const d = def.tags?.find(t => t[0] === "d")?.[1] || "";
                  setBadgeDefMap(m => new Map(m).set(`30009:${def.pubkey}:${d}`, def));
                },
                complete: () => { if (!cancelled) setBadgesLoading(false); },
                error:    () => { if (!cancelled) setBadgesLoading(false); },
              });
            },
            error: () => { if (!cancelled) setBadgesLoading(false); },
          });
        } else {
          setBadgesLoading(false);
        }
      },
      error: () => { if (!cancelled) setBadgesLoading(false); },
    });
    activeSubs.push(badgesSub);

    // Phase 7 — goals (kind 9041), fetched last
    const goalsSub = pool.request(relayUrls, [{ kinds: [9041], authors: [pubkey], limit: 100 }]).subscribe({
      next: raw => { eventStore.add(raw); byId.set(raw.id, raw); },
      complete: flush,
    });
    activeSubs.push(goalsSub);

    return () => {
      cancelled = true;
      for (const sub of activeSubs) { try { sub.unsubscribe(); } catch {} }
    };
  }, [pubkey, isOwn]);

  // Content subscriptions — articles, highlights, listings — re-run when the
  // profile's outbox relays become known so data from the author's preferred
  // relays is included even if those relays aren't in the user's pool.
  useEffect(() => {
    if (!pubkey) return;
    let cancelled = false;
    const subs = [];

    // Use pool.group(urls, false) to bypass ignoreOffline so newly-discovered
    // outbox relays are queried even before their WebSocket handshake completes.
    const req = (filters) => pool.group(contentRelayUrls, false).request(filters);

    setArticlesLoading(true);
    const articlesSub = req([{ kinds: [30023], authors: [pubkey], limit: 100 }]).subscribe({
      next: raw => {
        if (cancelled) return;
        eventStore.add(raw);
        setArticleEvents(prev => prev.some(e => e.id === raw.id) ? prev : [...prev, raw]);
      },
      complete: () => { if (!cancelled) setArticlesLoading(false); },
      error:    () => { if (!cancelled) setArticlesLoading(false); },
    });
    subs.push(articlesSub);

    setHighlightsLoading(true);
    const highlightsSub = req([{ kinds: [9802], authors: [pubkey], limit: 100 }]).subscribe({
      next: raw => {
        if (cancelled) return;
        eventStore.add(raw);
        setHighlightEventsList(prev => prev.some(e => e.id === raw.id) ? prev : [...prev, raw]);
      },
      complete: () => { if (!cancelled) setHighlightsLoading(false); },
      error:    () => { if (!cancelled) setHighlightsLoading(false); },
    });
    subs.push(highlightsSub);

    setListingsLoading(true);
    const listingKinds = isOwn ? [30402, 30403] : [30402];
    const listingsSub = req([{ kinds: listingKinds, authors: [pubkey], limit: 100 }]).subscribe({
      next: raw => {
        if (cancelled) return;
        eventStore.add(raw);
        setListingEvents(prev => prev.some(e => e.id === raw.id) ? prev : [...prev, raw]);
      },
      complete: () => { if (!cancelled) setListingsLoading(false); },
      error:    () => { if (!cancelled) setListingsLoading(false); },
    });
    subs.push(listingsSub);

    return () => {
      cancelled = true;
      for (const sub of subs) { try { sub.unsubscribe(); } catch {} }
    };
  }, [pubkey, isOwn, contentRelayKey]);

  const mergedEvents = useMemo(() => {
    const byId = new Map();
    for (const e of events || []) byId.set(e.id, e);
    for (const e of profileEvents || []) byId.set(e.id, e);
    for (const e of articleEvents) byId.set(e.id, e);
    for (const e of highlightEventsList) byId.set(e.id, e);
    for (const e of Object.values(repostExtras)) byId.set(e.id, e);
    return Array.from(byId.values());
  }, [events, profileEvents, articleEvents, highlightEventsList, repostExtras]);

  const theirEvents = useMemo(
    () => isMuted?.(pubkey) ? [] : mergedEvents.filter(e => e.pubkey === pubkey && (e.kind === 1 || e.kind === 6 || e.kind === 9802 || e.kind === 1068 || e.kind === 6969 || e.kind === 31922 || e.kind === 31923 || e.kind === 30311 || e.kind === 9041 || e.kind === 9735)),
    [mergedEvents, pubkey, isMuted]
  );

  const topLevel = useMemo(
    () => theirEvents
      .filter(e => e.kind === 6 || e.kind === 9802 || e.kind === 9735 || isQuoteRepost(e) || (e.kind === 1 && !hasNonMentionETag(e)) || e.kind === 1068 || e.kind === 6969 || e.kind === 31922 || e.kind === 31923 || e.kind === 30311 || e.kind === 9041)
      .sort((a, b) => b.created_at - a.created_at),
    [theirEvents]
  );


  const goals = useMemo(
    () => mergedEvents
      .filter(e => e.pubkey === pubkey && e.kind === 9041)
      .sort((a, b) => b.created_at - a.created_at),
    [mergedEvents, pubkey]
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

  const highlights = useMemo(
    () => mergedEvents
      .filter(e => e.pubkey === pubkey && e.kind === 9802)
      .sort((a, b) => b.created_at - a.created_at),
    [mergedEvents, pubkey]
  );

  const listings = useMemo(
    () => [...listingEvents].sort((a, b) => b.created_at - a.created_at),
    [listingEvents]
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
      .sort((a, b) => b.created_at - a.created_at),
    [allEvents, pubkey, myPubkey]
  );

  return (
    <div ref={scrollRef} className="slide-panel-scroll" onScroll={handleProfileScroll}>
      <div
        className="profile-banner"
        style={{ position: "relative", cursor: p.banner ? "pointer" : undefined }}
        onClick={p.banner ? () => setLightboxUrl(p.banner) : undefined}
      >
        {p.banner ? (
          <>
            <img className="profile-banner-image" src={p.banner} alt="" onError={e => { e.target.style.display = "none"; }} />
            <div className="profile-banner-overlay" />
          </>
        ) : (
          <div className="profile-banner-glyph">◎</div>
        )}
        <button
          className="back-btn"
          onClick={e => { e.stopPropagation(); onBack(); }}
          style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,.25)", backdropFilter: "blur(8px)", color: "white" }}
        >
          <Bk s={16} />
        </button>
        {!isOwn && (
          <div style={{ position: "absolute", top: 12, right: 12 }}>
            <button
              type="button"
              className="back-btn"
              style={{ background: "rgba(0,0,0,.25)", backdropFilter: "blur(8px)", color: "white", flexDirection: "column", gap: "2.5px" }}
              onClick={e => { e.stopPropagation(); setProfileMenuOpen(v => !v); }}
              aria-label="More options"
            >
              <span style={{ width: 2.5, height: 2.5, borderRadius: "50%", background: "currentColor", display: "block" }} />
              <span style={{ width: 2.5, height: 2.5, borderRadius: "50%", background: "currentColor", display: "block" }} />
              <span style={{ width: 2.5, height: 2.5, borderRadius: "50%", background: "currentColor", display: "block" }} />
            </button>
            {profileMenuOpen && (
              <ProfileContextMenu pubkey={pubkey} onClose={() => setProfileMenuOpen(false)} />
            )}
          </div>
        )}
      </div>

      <div className="profile-identity" style={{ paddingBottom: 16 }}>
        <div className="profile-av-wrap">
          <div style={{ position: "relative", display: "inline-block" }}>
            <div
              className={`profile-av${activeStream ? " profile-av-live" : ""}`}
              onClick={activeStream ? () => onOpenStream?.(activeStream) : (p.picture ? () => setLightboxUrl(p.picture) : undefined)}
              style={(activeStream || p.picture) ? { cursor: "pointer" } : undefined}
            >
              {p.picture
                ? <img src={p.picture} alt={name} onError={e => { e.target.style.display = "none"; }} />
                : name[0]?.toUpperCase()}
            </div>
            {activeStream && <div className="profile-av-live-badge">LIVE</div>}
          </div>
          {isOwn && <button className="profile-edit-btn" onClick={onEditProfile}>Edit profile</button>}
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
        {p.about && <ProfileText className="profile-about" text={p.about} profiles={profiles} onOpenProfile={onOpenProfile} />}
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
        {!isOwn && (
          <div className={`profile-stat ${tab === "between" ? "active" : ""}`} onClick={() => switchTab("between")}>
            <div className="profile-stat-label">Between us</div>
          </div>
        )}
        <div className={`profile-stat ${tab === "listings" ? "active" : ""}`} onClick={() => switchTab("listings")}>
          <div className="profile-stat-label">Listings</div>
        </div>
        <div className={`profile-stat ${tab === "articles" ? "active" : ""}`} onClick={() => switchTab("articles")}>
          <div className="profile-stat-label">Articles</div>
        </div>
        <div className={`profile-stat ${tab === "highlights" ? "active" : ""}`} onClick={() => switchTab("highlights")}>
          <div className="profile-stat-label">Highlights</div>
        </div>
        <div className={`profile-stat ${tab === "badges" ? "active" : ""}`} onClick={() => switchTab("badges")}>
          <div className="profile-stat-label">Badges</div>
        </div>
        <div className={`profile-stat ${tab === "goals" ? "active" : ""}`} onClick={() => switchTab("goals")}>
          <div className="profile-stat-label">Goals</div>
        </div>
      </div>

      {/* Notes tab */}
      {tab === "notes" && (
        profileLoading && topLevel.length === 0
          ? [0, 1, 2].map(i => <SkelCard key={i} />)
          : topLevel.length === 0
            ? <div className="empty-state"><div className="empty-state-title">No notes yet</div><div className="empty-state-sub">Notes, reposts, and quote reposts will appear here</div></div>
            : topLevel.slice(0, visibleNotes).map(e =>
                <FeedItem
                  key={e.id}
                  event={e}
                  profiles={profiles}
                  myPubkey={myPubkey}
                  myProfile={myProfile}
                  events={mergedEvents}
                  resolveEventById={resolveEventById}
                  isBookmarked={isBookmarked}
                  onBookmark={onBookmark}
                  onOpenProfile={onOpenProfile}
                  onOpenThread={onOpenThread}
                  onOpenHashtag={onOpenHashtag}
                  onOpenArticle={onOpenArticle}
                  onOpenStream={onOpenStream}
                  onOpenZaps={onOpenZaps}
                  onOpenReactions={onOpenReactions}
                  onOpenReposts={onOpenReposts}
                  onOpenPollVotes={onOpenPollVotes}
                  onPublish={onPublish}
                  publishEvent={publishEvent}
                  onPrepend={onPrepend}
                  onRequestModal={onRequestModal}
                  onDismissModal={onDismissModal}
                  getLocalZaps={getLocalZaps}
                  addLocalZap={addLocalZap}
                  getLocalReactions={getLocalReactions}
                  setLocalReaction={setLocalReaction}
                  sendZap={sendZap}
                  defaultZapAmount={defaultZapAmount}
                  defaultZapMsg={defaultZapMsg}
                  onZapFail={onZapFail}
                  customEmojis={customEmojis}
                  delay={0}
                />
            )
      )}

      {/* Replies tab */}
      {tab === "replies" && (
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
                  customEmojis={customEmojis}
                  delay={0}
                />
              );
            })
      )}

      {/* Articles tab */}
      {tab === "articles" && (
        (articlesLoading || profileLoading) && articles.length === 0
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

      {/* Highlights tab */}
      {tab === "highlights" && (
        (highlightsLoading || profileLoading) && highlights.length === 0
          ? [0, 1, 2].map(i => <SkelCard key={i} />)
          : highlights.length === 0
            ? <div className="empty-state"><div className="empty-state-title">No highlights yet</div><div className="empty-state-sub">Highlighted passages from notes and articles will appear here</div></div>
            : highlights.slice(0, visibleHighlights).map(e => (
                <HighlightCard
                  key={e.id}
                  event={e}
                  profiles={profiles}
                  liked={false}
                  bookmarked={isBookmarked?.(e) || false}
                  likeCount={0}
                  myPubkey={myPubkey}
                  myProfile={myProfile}
                  onLike={() => {}}
                  onBookmark={onBookmark}
                  onOpenProfile={onOpenProfile}
                  onOpenThread={onOpenThread}
                  onOpenArticle={onOpenArticle}
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
                  resolveEventById={resolveEventById}
                  customEmojis={customEmojis}
                  delay={0}
                />
              ))
      )}

      {/* Goals tab */}
      {tab === "goals" && (
        profileLoading && goals.length === 0
          ? [0, 1, 2].map(i => <SkelCard key={i} />)
          : goals.length === 0
            ? <div className="empty-state"><div className="empty-state-title">No goals yet</div><div className="empty-state-sub">Zap goals will appear here</div></div>
            : goals.slice(0, visibleNotes).map(e =>
                <FeedItem
                  key={e.id}
                  event={e}
                  profiles={profiles}
                  myPubkey={myPubkey}
                  myProfile={myProfile}
                  events={mergedEvents}
                  resolveEventById={resolveEventById}
                  isBookmarked={isBookmarked}
                  onBookmark={onBookmark}
                  onOpenProfile={onOpenProfile}
                  onOpenThread={onOpenThread}

                  onOpenHashtag={onOpenHashtag}
                  onOpenZaps={onOpenZaps}
                  onOpenReactions={onOpenReactions}
                  onOpenReposts={onOpenReposts}
                  onPublish={onPublish}
                  publishEvent={publishEvent}
                  onPrepend={onPrepend}
                  onRequestModal={onRequestModal}
                  onDismissModal={onDismissModal}
                  getLocalZaps={getLocalZaps}
                  addLocalZap={addLocalZap}
                  getLocalReactions={getLocalReactions}
                  setLocalReaction={setLocalReaction}
                  sendZap={sendZap}
                  defaultZapAmount={defaultZapAmount}
                  defaultZapMsg={defaultZapMsg}
                  onZapFail={onZapFail}
                  customEmojis={customEmojis}
                  delay={0}
                />
            )
      )}

      {/* Listings tab */}
      {tab === "listings" && (
        <>
          {selectedListing ? (
            <ListingDetail
              event={selectedListing}
              profiles={profiles}
              myPubkey={myPubkey}
              onOpenProfile={onOpenProfile}
              publishEvent={publishEvent}
              onDelete={id => { setListingEvents(prev => prev.filter(ev => ev.id !== id)); setSelectedListing(null); }}
              onUpdated={(oldId, newEv) => { setListingEvents(prev => prev.map(ev => ev.id === oldId ? newEv : ev)); setSelectedListing(null); }}
              onBack={() => setSelectedListing(null)}
            />
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px 0" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search listings…"
                    value={listingsSearch}
                    onChange={e => setListingsSearch(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px 7px 28px", borderRadius: 20, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
                  />
                </div>
                {isOwn && (
                  <button
                    type="button"
                    className="profile-follow-btn"
                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, flexShrink: 0 }}
                    onClick={() => setCreateListingOpen(true)}
                  >
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    New listing
                  </button>
                )}
              </div>
              {(() => {
                const q = listingsSearch.trim().toLowerCase();
                const filtered = q
                  ? listings.filter(e => {
                      const title    = e.tags?.find(t => t[0] === "title")?.[1]    || "";
                      const summary  = e.tags?.find(t => t[0] === "summary")?.[1]  || "";
                      const location = e.tags?.find(t => t[0] === "location")?.[1] || "";
                      const tags     = e.tags?.filter(t => t[0] === "t").map(t => t[1]).join(" ") || "";
                      return [title, summary, location, tags, e.content].join(" ").toLowerCase().includes(q);
                    })
                  : listings;
                if (listingsLoading && listings.length === 0)
                  return [0, 1, 2].map(i => <SkelCard key={i} />);
                if (filtered.length === 0)
                  return <div className="empty-state"><div className="empty-state-title">{listings.length === 0 ? "No listings yet" : "No results"}</div><div className="empty-state-sub">{listings.length === 0 ? "Classified listings will appear here" : "Try a different search term"}</div></div>;
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "12px 12px 20px" }}>
                    {filtered.map(e => (
                      <ListingCard
                        key={e.id}
                        event={e}
                        profiles={profiles}
                        myPubkey={myPubkey}
                        onOpenProfile={onOpenProfile}
                        publishEvent={publishEvent}
                        onSelect={setSelectedListing}
                        delay={0}
                      />
                    ))}
                  </div>
                );
              })()}
              {createListingOpen && (
                <CreateListingSheet
                  publishEvent={publishEvent}
                  onCreated={ev => setListingEvents(prev => prev.some(e => e.id === ev.id) ? prev : [ev, ...prev])}
                  onDismiss={() => setCreateListingOpen(false)}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Badges tab */}
      {tab === "badges" && (() => {
        if (selectedBadge) {
          const aTag = selectedBadge.tags?.find(t => t[0] === "a")?.[1] || "";
          const parts = aTag.split(":");
          const defEvent = badgeDefMap.get(`30009:${parts[1] || selectedBadge.pubkey}:${parts[2] || ""}`);
          const isAccepted = acceptedPairs.some(p => p.eTag === selectedBadge.id);
          return (
            <BadgeDetail
              awardEvent={selectedBadge}
              defEvent={defEvent}
              profiles={profiles}
              isAccepted={isAccepted}
              onAccept={isOwn && !isAccepted ? handleBadgeAccept : null}
              onRemove={isOwn && isAccepted ? handleBadgeRemove : null}
              onOpenProfile={onOpenProfile}
              onBack={() => setSelectedBadge(null)}
            />
          );
        }

        const acceptedIds = new Set(acceptedPairs.map(p => p.eTag));
        const unaccepted  = isOwn ? allAwardEvents.filter(e => !acceptedIds.has(e.id)).sort((a, b) => b.created_at - a.created_at) : [];
        const hasAny      = acceptedPairs.length > 0 || unaccepted.length > 0;

        if (badgesLoading && !hasAny) return [0, 1, 2].map(i => <SkelCard key={i} />);
        if (!hasAny) return (
          <div className="empty-state">
            <div className="empty-state-title">No badges yet</div>
            <div className="empty-state-sub">{isOwn ? "Badges you accept will appear here" : "Accepted badges will appear here"}</div>
          </div>
        );

        return (
          <>
            {acceptedPairs.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "12px 12px 20px" }}>
                {acceptedPairs.map((pair, i) => {
                  const [, issuerPk, dTag] = pair.aTag.split(":");
                  const defEvent  = badgeDefMap.get(`30009:${issuerPk}:${dTag}`);
                  // Use the full award event if loaded; otherwise a minimal placeholder so the
                  // card stays clickable and BadgeDetail can still show issuer + context menu.
                  const awardEvent = badgeAwardMap.get(pair.eTag)
                    ?? { id: pair.eTag, tags: [["a", pair.aTag]], pubkey: issuerPk || "", created_at: 0 };
                  return (
                    <BadgeCard
                      key={pair.eTag}
                      awardEvent={awardEvent}
                      defEvent={defEvent}
                      onClick={setSelectedBadge}
                      delay={i * 0.03}
                    />
                  );
                })}
              </div>
            )}
            {unaccepted.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setNotAcceptedOpen(v => !v)}
                  style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 16px", background: "none", border: "none", borderTop: acceptedPairs.length > 0 ? "1px solid var(--border)" : "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ transition: "transform .2s", transform: notAcceptedOpen ? "rotate(90deg)" : "rotate(0deg)" }}><polyline points="9 18 15 12 9 6" /></svg>
                  Not accepted
                  <span style={{ marginLeft: "auto", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{unaccepted.length}</span>
                </button>
                {notAcceptedOpen && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "4px 12px 20px" }}>
                    {unaccepted.map((award, i) => {
                      const aTag = award.tags?.find(t => t[0] === "a")?.[1] || "";
                      const [, issuerPk, dTag] = aTag.split(":");
                      const defEvent = badgeDefMap.get(`30009:${issuerPk}:${dTag}`);
                      return (
                        <BadgeCard
                          key={award.id}
                          awardEvent={award}
                          defEvent={defEvent}
                          onClick={setSelectedBadge}
                          onAccept={() => handleBadgeAccept(award)}
                          delay={i * 0.03}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        );
      })()}

      {/* Media tab — always mounted so thumbnail images stay in DOM across tab switches */}
      <ProfileMediaGrid
        visible={tab === "media"}
        items={mediaItems}
        loading={mediaLoading}
        exhausted={mediaExhausted}
        onLoadMore={fetchMediaBatch}
        onOpenThread={onOpenThread}
      />

      {profileNotesJsonEvent && <NoteJsonModal event={profileNotesJsonEvent} onClose={() => setProfileNotesJsonEvent(null)} />}
      {lightboxUrl && (
        <MediaLightbox
          items={[{ url: lightboxUrl, type: "image" }]}
          index={0}
          onClose={() => setLightboxUrl(null)}
          onIndexChange={() => {}}
        />
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
                  delay={0}
                />
              ))
      )}
    </div>
  );
}
