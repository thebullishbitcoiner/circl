import { useState, useEffect, useRef, useMemo } from "react";
import { pool, eventStore } from "../nostr.js";
import { DEFAULT_RELAYS } from "../constants.js";
import { isQuoteRepost } from "../utils.js";
import { useNip05DomainMembers } from "../hooks/useNip05DomainMembers.js";
import useProfiles from "../hooks/useProfiles.js";
import FeedItem from "./FeedItem.jsx";
import DomainFavicon from "./DomainFavicon.jsx";
import { Bk, ExtL } from "./icons.jsx";

const MAX_AUTHORS = 500;
const MAX_RENDERED_NOTES = 150; // bound per-flush render cost regardless of how large a domain is
const VISIBLE_STEP = 20; // window of mounted cards; grows as the user scrolls, like ProfilePage's notes tab
const SCROLL_THRESHOLD_PX = 300;
const FEED_KINDS = [1, 6, 30023]; // notes (incl. quote reposts), reposts, articles
const FLUSH_INTERVAL_MS = 200; // batch incoming events so a relay burst doesn't cause a re-render per event
const PROFILES_FLUSH_INTERVAL_MS = 300; // throttle re-renders from useProfiles' per-event updates

const domainNotesCache = new Map(); // domain → { notes, ts }
const DOMAIN_NOTES_CACHE_TTL = 5 * 60 * 1000;
function getCachedDomainNotes(domain) {
  const cached = domainNotesCache.get(domain);
  return cached && Date.now() - cached.ts < DOMAIN_NOTES_CACHE_TTL ? cached.notes : null;
}

// Persists scroll position (and how many cards were expanded into view) across
// unmount/remount — e.g. opening a note and coming back. Nip05DomainFeed isn't
// kept mounted in the background like ProfilePage is, so without this the whole
// panel remounts from scratch on every "back" and scroll resets to the top.
const savedFeedState = new Map(); // domain → { scrollTop, visibleCount }

const hasNonMentionETag = e => e.tags.some(t => t[0] === "e" && t[3] !== "mention");
const isReplyEvent = e => e.kind === 1 && hasNonMentionETag(e) && !isQuoteRepost(e);

// useProfiles fires one state update per incoming kind-0 event with no
// batching of its own — for a domain with hundreds of members, that's
// hundreds of re-renders of the whole note list trickling in over time.
// Throttle our own consumption of it instead of touching shared code.
function useThrottledValue(value, delay) {
  const [throttled, setThrottled] = useState(value);
  const latest = useRef(value);
  latest.current = value;
  const timer = useRef(null);
  useEffect(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      setThrottled(latest.current);
    }, delay);
  }, [value, delay]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return throttled;
}

export default function Nip05DomainFeed({
  domain, profiles: profilesProp, onBack, onOpenProfile, onOpenThread, onOpenHashtag, onOpenMembers,
  onOpenArticle,
  myPubkey, myProfile, onBookmark, isBookmarked,
  getLocalZaps, addLocalZap, getLocalReactions, setLocalReaction,
  publishEvent, onPrepend, onOpenZaps, onOpenReactions, onOpenReposts,
  sendZap, defaultZapAmount, defaultZapMsg, onZapFail, resolveEventById,
  customEmojis,
}) {
  const { pubkeys, loading: pubkeysLoading } = useNip05DomainMembers(domain);
  const { profiles: fetchedProfiles } = useProfiles({ pubkeys });
  const mergedProfiles = useMemo(() => ({ ...fetchedProfiles, ...profilesProp }), [profilesProp, fetchedProfiles]);
  const profiles = useThrottledValue(mergedProfiles, PROFILES_FLUSH_INTERVAL_MS);

  // Seed synchronously from cache (same reasoning as useNip05DomainMembers): a
  // remount within the cache window should show the same feed on its first
  // render, not flash back to a spinner while relay data reloads.
  const [notes, setNotes] = useState(() => getCachedDomainNotes(domain) ?? []);
  const [notesLoading, setNotesLoading] = useState(() => !getCachedDomainNotes(domain));
  const [visibleCount, setVisibleCount] = useState(() => savedFeedState.get(domain)?.visibleCount ?? VISIBLE_STEP);
  const notesLenRef = useRef(0);
  notesLenRef.current = notes.length;
  const subRef = useRef(null);
  const scrollRef = useRef(null);

  const handleScroll = e => {
    const el = e.currentTarget;
    savedFeedState.set(domain, { ...savedFeedState.get(domain), scrollTop: el.scrollTop });
    if (el.scrollHeight - el.scrollTop - el.clientHeight > SCROLL_THRESHOLD_PX) return;
    setVisibleCount(n => Math.min(n + VISIBLE_STEP, notesLenRef.current));
  };

  // Keep the saved window size in sync as it grows, so a remount restores enough
  // cards to actually reach the saved scroll position.
  useEffect(() => {
    savedFeedState.set(domain, { ...savedFeedState.get(domain), visibleCount });
  }, [domain, visibleCount]);

  // Restore scroll position after mount — e.g. opening a note and coming back.
  // notes/visibleCount arrive through a multi-hop async chain (domain → pubkeys
  // → cached/fetched notes), so a single-shot attempt right after mount can fire
  // before there's enough content to actually reach the saved offset, and the
  // browser silently clamps it. Retry as content grows instead, same idea as
  // ThreadView's scroll-restore retry, until the container is tall enough or a
  // few seconds pass.
  const pendingScrollRef = useRef(savedFeedState.get(domain)?.scrollTop ?? null);
  const scrollRestoredRef = useRef(false);

  useEffect(() => {
    if (pendingScrollRef.current == null || scrollRestoredRef.current) return;
    const el = scrollRef.current;
    if (!el || el.scrollHeight - el.clientHeight < pendingScrollRef.current) return;
    el.scrollTop = pendingScrollRef.current;
    scrollRestoredRef.current = true;
  }, [notes, visibleCount]);

  useEffect(() => {
    if (pendingScrollRef.current == null) return;
    const t = setTimeout(() => { scrollRestoredRef.current = true; }, 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (pubkeysLoading || pubkeys.length === 0) {
      if (!pubkeysLoading) setNotesLoading(false);
      return;
    }
    const authors = pubkeys.slice(0, MAX_AUTHORS);
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : DEFAULT_RELAYS;

    const cached = getCachedDomainNotes(domain);
    if (cached) {
      setNotes(cached);
      setNotesLoading(false);
      return;
    }

    setNotes([]);
    setNotesLoading(true);

    // Buffer incoming events and flush on a timer instead of one setState per
    // event — a burst of relay results (up to 500 authors × 3 kinds) can
    // otherwise trigger dozens of full-list re-renders within milliseconds,
    // which was making the header feel unresponsive during load.
    let buffer = [];
    let flushTimer = null;
    const flush = () => {
      flushTimer = null;
      if (buffer.length === 0) return;
      const incoming = buffer;
      buffer = [];
      setNotes(prev => {
        const seen = new Set(prev.map(e => e.id));
        const additions = incoming.filter(e => !seen.has(e.id));
        if (additions.length === 0) return prev;
        const next = [...additions, ...prev].sort((a, b) => b.created_at - a.created_at).slice(0, MAX_RENDERED_NOTES);
        domainNotesCache.set(domain, { notes: next, ts: Date.now() });
        return next;
      });
    };

    const sub = pool.group(relayUrls, false).request([{ kinds: FEED_KINDS, authors, limit: 100 }]).subscribe({
      next: ev => {
        eventStore.add(ev);
        if (isReplyEvent(ev)) return;
        buffer.push(ev);
        if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
      },
      error: () => { flush(); setNotesLoading(false); },
      complete: () => { flush(); setNotesLoading(false); },
    });

    subRef.current = sub;
    const t = setTimeout(() => setNotesLoading(false), 8000);
    return () => { sub.unsubscribe(); clearTimeout(t); clearTimeout(flushTimer); };
  }, [domain, pubkeysLoading, pubkeys]);

  const loading = pubkeysLoading || notesLoading;

  return (
    <div className="slide-panel-scroll" ref={scrollRef} onScroll={handleScroll}>
      <div className="panel-bar">
        <button type="button" className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span className="panel-bar-logo panel-bar-logo-domain">
          <DomainFavicon domain={domain} className="panel-bar-favicon" />
          <span className="panel-bar-domain-text">{domain}</span>
          <a
            href={`https://${domain}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            title="Open in new tab"
            className="panel-bar-external-link"
          >
            <ExtL s={13} />
          </a>
        </span>
        {!pubkeysLoading && pubkeys.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenMembers?.(domain)}
            style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--text-faint)", fontSize: 12, fontFamily: "'DM Sans',sans-serif", cursor: "pointer", padding: "3px 4px" }}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            {pubkeys.length.toLocaleString()}
          </button>
        )}
      </div>

      {loading && notes.length === 0 && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <div style={{ width: 22, height: 22, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        </div>
      )}

      {!pubkeysLoading && pubkeys.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 48 }}>
          <div className="empty-state-title">No pubkeys found</div>
          <div className="empty-state-sub">{domain}/.well-known/nostr.json</div>
        </div>
      )}

      {!loading && pubkeys.length > 0 && notes.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 48 }}>
          <div className="empty-state-title">No notes found</div>
          <div className="empty-state-sub">Notes, reposts, and articles will appear here</div>
        </div>
      )}

      {notes.slice(0, visibleCount).map((ev, i) => (
        <FeedItem
          key={ev.id}
          event={ev}
          events={notes}
          resolveEventById={resolveEventById}
          profiles={profiles}
          myPubkey={myPubkey}
          myProfile={myProfile}
          isBookmarked={isBookmarked}
          onBookmark={onBookmark}
          onOpenProfile={onOpenProfile}
          onOpenThread={onOpenThread}
          onOpenHashtag={onOpenHashtag}
          onOpenArticle={onOpenArticle}
          onOpenZaps={onOpenZaps}
          onOpenReactions={onOpenReactions}
          onOpenReposts={onOpenReposts}
          onPublish={onPrepend}
          publishEvent={publishEvent}
          onPrepend={onPrepend}
          getLocalZaps={getLocalZaps}
          addLocalZap={addLocalZap}
          getLocalReactions={getLocalReactions}
          setLocalReaction={setLocalReaction}
          sendZap={sendZap}
          defaultZapAmount={defaultZapAmount}
          defaultZapMsg={defaultZapMsg}
          onZapFail={onZapFail}
          customEmojis={customEmojis}
          delay={i * 0.03}
        />
      ))}
    </div>
  );
}
