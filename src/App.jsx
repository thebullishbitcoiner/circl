import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  displayName,
  relativeTime,
  avatarInitial,
  replyCount,
  repostAndQuoteCount,
  isQuoteRepost,
  isHexPubkey,
  normPubkey,
  nip19,
  parseKind6EmbeddedEvent,
  zapperPubkeyFromKind9735,
} from "./utils.js";
import useAuth from "./hooks/useAuth.js";
import { nostrSubscribe, eventLoader, eventStore, pool, validRelays } from "./nostr.js";
import { RELAYS } from "./constants.js";
import useFollows from "./hooks/useFollows.js";
import useFeed from "./hooks/useFeed.js";
import useNotifications from "./hooks/useNotifications.js";
import useProfiles from "./hooks/useProfiles.js";
import useBookmarks from "./hooks/useBookmarks.js";
import useMutes from "./hooks/useMutes.js";
import useCircles from "./hooks/useCircles.js";
import useCustomEmojiList from "./hooks/useCustomEmojiList.js";
import useBlossomServers from "./hooks/useBlossomServers.js";
import useBookmarkedEvents from "./hooks/useBookmarkedEvents.js";
import usePublish from "./hooks/usePublish.js";
import useIsMobile from "./hooks/useIsMobile.js";
import useDarkMode from "./hooks/useDarkMode.js";
import useTextSize from "./hooks/useTextSize.js";
import useWallet from "./hooks/useWallet.js";
import useZap from "./hooks/useZap.js";
import useZapSettings from "./hooks/useZapSettings.js";
import useWalletData from "./hooks/useWalletData.js";

import LoginScreen from "./components/LoginScreen.jsx";
import SettingsPage from "./components/SettingsPage.jsx";
import SkelCard from "./components/SkelCard.jsx";
import LongformCard from "./components/LongformCard.jsx";
import NoteCard from "./components/NoteCard.jsx";
import RepostCard from "./components/RepostCard.jsx";
import PollCard from "./components/PollCard.jsx";
import PollInline from "./components/PollInline.jsx";
import NoteActions from "./components/NoteActions.jsx";
import NavigationContext from "./context/NavigationContext.jsx";
import ArticleReader from "./components/ArticleReader.jsx";
import HighlightCard from "./components/HighlightCard.jsx";
import CalendarCard from "./components/CalendarCard.jsx";
import EventDetailView from "./components/EventDetailView.jsx";
import FeedItem from "./components/FeedItem.jsx";
import StreamCard from "./components/StreamCard.jsx";
import StreamDetailView from "./components/StreamDetailView.jsx";
import ComposeSheet from "./components/ComposeSheet.jsx";
import ProfilePage from "./components/ProfilePage.jsx";
import RelaysCard from "./components/RelaysCard.jsx";
import ParticipantsCard from "./components/ParticipantsCard.jsx";
import CirclePage from "./components/CirclePage.jsx";
import ThreadView from "./components/ThreadView.jsx";
import NotificationsFeed from "./components/NotificationsFeed.jsx";
import WalletPage from "./components/WalletPage.jsx";
import TxDetailPage from "./components/TxDetailPage.jsx";
import SearchPage from "./components/SearchPage.jsx";
import MutedPage from "./components/MutedPage.jsx";
import MyCirclesPage from "./components/MyCirclesPage.jsx";
import CircleDetailPage from "./components/CircleDetailPage.jsx";
import EditProfilePage from "./components/EditProfilePage.jsx";
import HashtagFeed from "./components/HashtagFeed.jsx";
import { ZapsScreen, ReactionsScreen, RepostsScreen, PollVotesScreen } from "./components/ListScreens.jsx";
import SwipePanel from "./components/SwipePanel.jsx";
import ZapGoalPage from "./components/ZapGoalPage.jsx";
import Avatar from "./components/Avatar.jsx";
import NoteContent from "./components/NoteContent.jsx";
import { SbHome, SbBell, SbBook, SbZap, SbSearch, SbWallet, NavHome, NavBell, NavBook, NavZap, NavSearch, NavWallet, Bk } from "./components/icons.jsx";
export default function App() {
  const { pubkey, status, error, login, logout, signAndPublish } = useAuth();
  const { follows, loading: fl, follow: followPk, unfollow: unfollowPk, refresh: refreshFollows } = useFollows({ pubkey, signAndPublish });

  const [likes, setLikes] = useState({});
  const [zapsByEvent, setZapsByEvent] = useState({});
  const [reactionsByEvent, setReactionsByEvent] = useState({});

  const getLocalZaps = useCallback(
    eventId => zapsByEvent[eventId] ?? [],
    [zapsByEvent]
  );
  const addLocalZap = useCallback((eventId, zap) => {
    setZapsByEvent(prev => {
      const current = prev[eventId] ?? [];
      if (zap.id && current.some(z => z.id === zap.id)) return prev;
      // Confirmed receipt arrived: drop the optimistic placeholder from the same zapper
      const base = (zap.id && zap.zapper)
        ? current.filter(z => !(z.zapper === zap.zapper && !z.id))
        : current;
      return { ...prev, [eventId]: [...base, zap].sort((a, b) => b.amount - a.amount) };
    });
  }, []);

  const getLocalReactions = useCallback(
    eventId => reactionsByEvent[eventId] ?? [],
    [reactionsByEvent]
  );
  const setLocalReaction = useCallback((eventId, pk, emoji, meta = {}) => {
    if (!emoji) return;
    const ts = meta.created_at ?? Math.floor(Date.now() / 1000);
    setReactionsByEvent(prev => {
      const current = prev[eventId] ?? [];
      if (meta.id) {
        // Relay-confirmed event: deduplicate by event id, replace any optimistic placeholder
        if (current.some(r => r.id === meta.id)) return prev;
        const filtered = current.filter(r => !(r.pk === pk && !r.id && r.emoji === emoji));
        return { ...prev, [eventId]: [...filtered, { pk, emoji, created_at: ts, ...meta }] };
      } else {
        // Optimistic (no id): one placeholder per pk while in-flight
        if (current.some(r => r.pk === pk && !r.id)) return prev;
        return { ...prev, [eventId]: [...current, { pk, emoji, created_at: ts }] };
      }
    });
  }, []);

  const { events, loading: el, prependEvent } = useFeed({
    follows,
    setLocalReaction,
    addLocalZap,
  });
  const { items: notificationEvents, loading: notifLoading } = useNotifications({ pubkey });
  const [bookmarkRefreshKey, setBookmarkRefreshKey] = useState(0);
  const { toggle: toggleBm, isBookmarked, bookmarkItems } = useBookmarks({ pubkey, signAndPublish, refreshKey: bookmarkRefreshKey });
  const { mutes, muteEvent, mute: muteUser, unmute: unmuteUser, isMuted } = useMutes({ pubkey, signAndPublish });
  const { circles, createCircle, renameCircle, deleteCircle, addMember: addCircleMember, removeMember: removeCircleMember } = useCircles({ pubkey, signAndPublish });
  const { emojis: customEmojis, sets: customEmojiSets, allCustomEmojis, addEmoji, removeEmoji, addSet: addEmojiSet, removeSet: removeEmojiSet, loading: customEmojiLoading } = useCustomEmojiList({ pubkey, signAndPublish });
  const { servers: blossomServers, saveServers: saveBlossomServers } = useBlossomServers({ pubkey, signAndPublish });
  const bookmarkLocalPool = useMemo(() => [...events, ...notificationEvents], [events, notificationEvents]);
  const { events: bookmarkFeedEvents, loading: bookmarkFeedLoading } = useBookmarkedEvents({
    bookmarkTags: bookmarkItems,
    localEvents: bookmarkLocalPool,
  });

  const mergedFeedMap = useMemo(() => {
    const m = new Map(events.map(e => [e.id, e]));
    for (const e of bookmarkFeedEvents) m.set(e.id, e);
    return m;
  }, [events, bookmarkFeedEvents]);

  const mergedFeedPool = useMemo(() => [...mergedFeedMap.values()], [mergedFeedMap]);

  const resolveEventById = useCallback(async (eventId, relayHints = []) => {
    if (!eventId) return null;
    const existing = mergedFeedMap.get(eventId);
    if (existing) return existing;
    // Fast path: event already known to the store from any prior fetch
    const stored = eventStore.getTimeline([{ ids: [eventId], limit: 1 }])?.[0];
    if (stored) return stored;
    // Always include connected relays so note1 refs (no hints) still get fetched
    const connected = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    const allRelays = relayHints.length
      ? [...new Set([...validRelays(relayHints), ...connected])]
      : connected;
    return new Promise(resolve => {
      let done = false;
      const sub = eventLoader({ id: eventId, relays: allRelays }).subscribe({
        next: ev => {
          if (done || !ev?.id) return;
          done = true;
          sub.unsubscribe();
          prependEvent(ev);
          resolve(ev);
        },
        error: () => { if (!done) { done = true; resolve(null); } },
        complete: () => { if (!done) { done = true; resolve(null); } },
      });
      setTimeout(() => { if (!done) { done = true; sub.unsubscribe(); resolve(null); } }, 8000);
    });
  }, [mergedFeedMap, prependEvent]);

  const allPks = useMemo(() => {
    const seen = new Set();
    const result = [];
    const add = pk => {
      const k = normPubkey(pk);
      if (isHexPubkey(k) && !seen.has(k)) { seen.add(k); result.push(k); }
    };
    // Priority 1: logged-in user — bottom nav avatar fetched first
    if (pubkey) add(pubkey);
    // Priority 2: notification actors — must resolve quickly for the notifications screen
    for (const n of notificationEvents) {
      add(n.pubkey);
      if (n.kind === 9735) {
        const zapper = zapperPubkeyFromKind9735(n);
        if (zapper) add(zapper);
      }
    }
    // Priority 3: authors of the first visible feed events (above the fold)
    for (const e of events.slice(0, 15)) add(e.pubkey);
    // Priority 4: everything else
    for (const e of mergedFeedPool) {
      add(e.pubkey);
      for (const t of e.tags || []) {
        if (t[0] === "p" && t[1]) add(t[1]);
      }
      if (e.kind === 6 && typeof e.content === "string" && e.content.trim().startsWith("{")) {
        try { add(JSON.parse(e.content)?.pubkey); } catch {}
      }
      if (e.kind === 9735) {
        const zapper = zapperPubkeyFromKind9735(e);
        if (zapper) add(zapper);
        const Ptag = e.tags?.find(t => t[0] === "P")?.[1];
        if (Ptag) add(Ptag);
      }
    }
    for (const zaps of Object.values(zapsByEvent)) {
      for (const z of zaps) add(z?.zapper);
    }
    for (const reacts of Object.values(reactionsByEvent)) {
      for (const r of reacts) add(typeof r === "string" ? r : r?.pk);
    }
    for (const f of follows) add(f);
    for (const m of mutes) add(m);
    for (const c of circles) for (const m of c.members) add(m);
    return result;
  }, [mergedFeedPool, events, follows, pubkey, zapsByEvent, reactionsByEvent, notificationEvents, mutes, circles]);
  const { profiles } = useProfiles({ pubkeys: allPks });
  const { publish, publishEvent, publishHighlight } = usePublish({ signAndPublish, pubkey });
  const isMobile = useIsMobile();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { textSize, setTextSize } = useTextSize();

  const [activeNav, setActiveNav] = useState("home");
  const [profileScrollTrigger, setProfileScrollTrigger] = useState(0);
  const [lastNotifSeenAt, setLastNotifSeenAt] = useState(() => {
    try { return parseInt(localStorage.getItem("circl_notif_seen_v1") || "0", 10); } catch { return 0; }
  });
  const [openStreamEvent, setOpenStreamEvent] = useState(null);
  const [navStack, setNavStack] = useState([]);

  const pushNav = entry => setNavStack(s => [...s, entry]);
  const popNav = () => setNavStack(s => s.slice(0, -1));
  const clearNav = () => setNavStack([]);

  const topEntry = navStack[navStack.length - 1] ?? null;
  // Walk the stack so profile relays persist when drilling into a note from a profile page
  const viewedProfilePubkey = (() => {
    for (let i = navStack.length - 1; i >= 0; i--) {
      if (navStack[i].type === "profile") return navStack[i].payload;
    }
    return null;
  })();

  const prevEntry = navStack[navStack.length - 2] ?? null;
  const backLabel = (() => {
    if (!prevEntry) return "Home";
    if (prevEntry.type === "profile") {
      const n = profiles?.[prevEntry.payload]?.name;
      return n || "Profile";
    }
    return "Note";
  })();

  const handleOpenProfile     = pk => { if (pk === pubkey) refreshFollows(); pushNav({ type: "profile", payload: pk }); };
  const handleEditProfile     = () => pushNav({ type: "edit-profile" });
  const handleOpenTransaction = tx => pushNav({ type: "transaction", payload: tx });
  const handleOpenCircle = ({ pubkey: cpk, follows: cFollows }) =>
    pushNav({ type: "circle", payload: { pubkey: cpk, follows: cFollows } });
  const handleOpenNote = event => pushNav({ type: "note", payload: event });
  const handleOpenArticle = event => pushNav({ type: "article", payload: event });
  const handleOpenThread  = event => pushNav({ type: "thread",  payload: event });
  const handleOpenGoal            = event => pushNav({ type: "goal",     payload: event });
  const handleOpenCalendarEvent   = event => pushNav({ type: "calendar", payload: event });
  const handleOpenPoll            = event => pushNav({ type: "thread",  payload: event });
  const handleOpenZaps = ({ eventId, zaps }) => pushNav({ type: "zaps", payload: { eventId, zaps } });
  const handleOpenReactions = ({ eventId, reactions }) => pushNav({ type: "reactions", payload: { eventId, reactions } });
  const handleOpenReposts = ({ eventId, reposts }) => pushNav({ type: "reposts", payload: { eventId, reposts } });
  const handleOpenHashtag = tag => pushNav({ type: "hashtag", payload: tag });
  const handleOpenPollVotes = ({ event, options, voteEvents, isZapPoll }) =>
    pushNav({ type: "poll-votes", payload: { event, options, voteEvents, isZapPoll } });

  const handleBack = () => {
    if (navStack.length > 0) popNav();
  };

  const { wallet, saveWallet, disconnect: disconnectWallet } = useWallet();
  const { sendZap } = useZap(wallet);
  const { zapSettings, saveZapSettings } = useZapSettings();
  const { balance: walletBalance, transactions: walletTxs, loading: walletLoading, error: walletError, refresh: refreshWallet } = useWalletData(wallet);
  const [floatingCompose, setFloatingCompose] = useState(false);
  const [composeCircle, setComposeCircle] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [panelModal, setPanelModal] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const feedScrollRef = useRef(null);

  const handleFeedScroll = useCallback(e => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      setVisibleCount(n => n + 15);
    }
  }, []);

  const [toast, setToast] = useState({ msg: "", show: false });
  const toastRef = useRef(null);

  const showToast = msg => {
    clearTimeout(toastRef.current);
    setToast({ msg, show: true });
    toastRef.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2200);
  };

  const handleOpenNotification = async ev => {
    if (ev.kind === 30023) {
      handleOpenArticle(ev);
      return;
    }
    if (ev.kind === 1) {
      handleOpenThread(ev);
      return;
    }
    if (ev.kind === 6) {
      const emb = parseKind6EmbeddedEvent(ev);
      if (emb) {
        handleOpenThread(emb);
        return;
      }
      const id = ev.tags?.find(t => t[0] === "e")?.[1];
      if (id) {
        const r = await resolveEventById(id);
        if (r) handleOpenThread(r);
        else showToast("Could not load that note");
      }
      return;
    }
    if (ev.kind === 1018) {
      const id = ev.tags?.find(t => t[0] === "e")?.[1];
      if (!id) return;
      const r = await resolveEventById(id);
      if (r) handleOpenThread(r);
      else showToast("Could not load that poll");
      return;
    }
    if (ev.kind === 7 || ev.kind === 9735) {
      const id = ev.tags?.find(t => t[0] === "e")?.[1];
      if (!id) {
        showToast("No note linked to this event");
        return;
      }
      const r = await resolveEventById(id);
      if (!r) { showToast("Could not load that note"); return; }
      if (r.kind === 9041) handleOpenGoal(r);
      else handleOpenThread(r);
    }
  };

  const getLike = (id, def = 0) => likes[id] || { liked: false, count: def };
  const handleLike = id =>
    setLikes(p => {
      const c = p[id] || { liked: false, count: 0 };
      return { ...p, [id]: { liked: !c.liked, count: c.liked ? c.count - 1 : c.count + 1 } };
    });
  const handleBookmark = async event => {
    try {
      const was = isBookmarked(event);
      await toggleBm(event);
      if (!was) setBookmarkRefreshKey(k => k + 1);
      showToast(was ? "Removed from bookmarks" : "Saved to bookmarks");
    } catch (e) {
      showToast(e?.message || "Could not update bookmarks");
    }
  };

  const handleMuteUser = async pk => {
    try {
      await muteUser(pk);
      showToast("User muted");
    } catch (e) {
      showToast(e?.message || "Could not update mute list");
    }
  };

  const handleUnmuteUser = async pk => {
    try {
      await unmuteUser(pk);
      showToast("User unmuted");
    } catch (e) {
      showToast(e?.message || "Could not update mute list");
    }
  };

  const handleDeleteCircle = async id => {
    try {
      await deleteCircle(id);
      showToast("Circle deleted");
    } catch (e) {
      showToast(e?.message || "Could not delete circle");
    }
  };

  const handleComposeToCircle = circle => {
    setComposeCircle(circle);
    setFloatingCompose(true);
  };

  const hasUnread = (notificationEvents[0]?.created_at ?? 0) > lastNotifSeenAt;

  const navigate = nav => {
    if (nav === activeNav && !settingsOpen && navStack.length === 0) {
      feedScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
    setActiveNav(nav);
    setOpenStreamEvent(null);
    setVisibleCount(20);
    setSettingsOpen(false);
    clearNav();
    if (nav === "profile") { refreshFollows(); pushNav({ type: "profile", payload: pubkey }); }
    if (nav === "notifications") {
      const now = Math.floor(Date.now() / 1000);
      setLastNotifSeenAt(now);
      try { localStorage.setItem("circl_notif_seen_v1", String(now)); } catch {}
    }
    if (nav === "zaps" && activeNav !== "zaps") refreshWallet();
  };

  const displayEvs = (activeNav === "bookmarks" ? bookmarkFeedEvents : events).filter(e => !isMuted(e.pubkey));
  const isLoading = fl || el;
  const anyPanelOpen = settingsOpen || !!openStreamEvent || navStack.length > 0;
  const myProfile = profiles[pubkey];
  const myDisplayName = displayName(pubkey, profiles);
  const myNpub = (() => {
    try {
      const npub = nip19.npubEncode(pubkey);
      return `${npub.slice(0, 11)}…${npub.slice(-11)}`;
    } catch {
      return "";
    }
  })();

  const navItems = [
    { id: "home",          label: "Home",     SbIcon: <SbHome />,   NavIcon: <NavHome /> },
    { id: "notifications", label: "Notifications", SbIcon: <SbBell />,   NavIcon: <NavBell /> },
    { id: "zaps",          label: "Wallet",      SbIcon: <SbWallet />, NavIcon: <NavWallet /> },
    { id: "search",        label: "Search",   SbIcon: <SbSearch />, NavIcon: <NavSearch /> },
    { id: "bookmarks",     label: "Bookmarks", SbIcon: <SbBook />,   NavIcon: <NavBook /> },
  ];

  useEffect(() => () => clearTimeout(toastRef.current), []);

  if (status !== "ready") {
    return (
      <>
        <LoginScreen onLogin={login} status={status} error={error} />
      </>
    );
  }

  return (
    <NavigationContext.Provider value={{
      onOpenThread: handleOpenThread,
      onOpenProfile: handleOpenProfile,
      onOpenGoal: handleOpenGoal,
      onOpenPoll: handleOpenPoll,
      onOpenCalendarEvent: handleOpenCalendarEvent,
      onOpenStream: setOpenStreamEvent,
      onOpenArticle: handleOpenArticle,
      onOpenHashtag: handleOpenHashtag,
      onOpenZaps: handleOpenZaps,
      onOpenReactions: handleOpenReactions,
      onOpenReposts: handleOpenReposts,
        onOpenPollVotes: handleOpenPollVotes,
      isMuted,
      onMuteUser: handleMuteUser,
      onUnmuteUser: handleUnmuteUser,
      myPubkey: pubkey,
      mutes,
    }}>
    <>
      <div className="app-shell">

        <aside className={`sidebar ${isMobile ? "collapsed" : ""}`}>
          <div className="logo"><img src="/logo.png" alt="Circl" style={{ height: 28, width: "auto" }} /></div>
          {navItems.map(item => (
            <button key={item.id} className={`nav-item ${activeNav === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}>
              <div style={{ position: "relative", display: "inline-flex" }}>
                {item.SbIcon}
                {item.id === "notifications" && hasUnread && <div className="notif-unread-dot" />}
              </div>
              {item.label}
            </button>
          ))}
          <button className={`nav-item ${topEntry?.type === "muted" ? "active" : ""}`} onClick={() => { clearNav(); setSettingsOpen(false); setActiveNav(null); pushNav({ type: "muted" }); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
            Muted
          </button>
          <button className={`nav-item ${topEntry?.type === "mycircles" || topEntry?.type === "circle-detail" ? "active" : ""}`} onClick={() => { clearNav(); setSettingsOpen(false); setActiveNav(null); pushNav({ type: "mycircles" }); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              <circle cx="19" cy="8" r="2.5" />
              <path d="M21.5 14c1.5.7 2.5 2 2.5 3.5" />
            </svg>
            Circles
          </button>
          <button className={`nav-item ${settingsOpen ? "active" : ""}`} onClick={() => { clearNav(); setSettingsOpen(true); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="nav-icon">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </button>
          <button className="compose-btn" onClick={() => setFloatingCompose(true)}>+ New Note</button>
          <div className="sidebar-profile" onClick={() => navigate("profile")}>
            <div className="sidebar-av">{myProfile?.picture ? <img src={myProfile.picture} alt="me" /> : avatarInitial(pubkey, profiles)}</div>
            <div><div className="sidebar-name">{myDisplayName}</div><div className="sidebar-npub">{myNpub}</div></div>
          </div>
          <button className="logout-btn" onClick={logout}>Sign out</button>
        </aside>

        <div className="view-container">

          <div className="feed-view">
            <div className="feed-main">
              <div className="feed-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="feed-title">
                    {activeNav === "home" && "Home"}
                    {activeNav === "bookmarks" && "Bookmarks"}
                    {activeNav === "notifications" && "Notifications"}
                    {activeNav === "zaps" && "Wallet"}
                    {activeNav === "search" && "Search"}
                    {activeNav === "profile" && "Profile"}
                  </div>
                  {activeNav === "bookmarks" && bookmarkFeedEvents.length > 0 && (
                    <span style={{
                      background: "var(--primary)", color: "white",
                      borderRadius: 50, fontSize: 11, fontWeight: 500,
                      padding: "1px 8px", fontFamily: "'DM Sans',sans-serif",
                    }}>{bookmarkFeedEvents.length}</span>
                  )}
                </div>
              </div>
              <div className="feed-scroll" ref={feedScrollRef} onScroll={handleFeedScroll}
                style={activeNav === "search" ? { display: "none" } : undefined}>
                {(activeNav === "home" || activeNav === "bookmarks") && (
                  (activeNav === "home" && isLoading && events.length === 0) ||
                  (activeNav === "bookmarks" && bookmarkFeedLoading && bookmarkFeedEvents.length > 0)
                    ? [0, 1, 2, 3].map(i => <SkelCard key={i} />)
                    : displayEvs.length === 0
                      ? (
                        <div className="empty-state">
                          <div className="empty-state-title">{activeNav === "bookmarks" ? "Nothing saved yet" : "No notes yet"}</div>
                          <div className="empty-state-sub">{activeNav === "bookmarks" ? "Bookmark notes and articles to find them here" : "Notes from your follows will appear here"}</div>
                        </div>
                      )
                      : (() => {
                        const filtered = activeNav === "bookmarks"
                          ? displayEvs
                          : displayEvs.filter(ev =>
                              ev.kind === 30023 ||
                              ev.kind === 6 ||
                              ev.kind === 9802 ||
                              ev.kind === 31922 ||
                              ev.kind === 31923 ||
                              ev.kind === 9041 ||
                              !ev.tags.some(t => t[0] === "e" && t[3] !== "mention")
                            );
                        const visible = filtered.slice(0, visibleCount);
                        return (
                          <>
                            {visible.map(ev =>
                              <FeedItem
                                key={ev.id}
                                event={ev}
                                profiles={profiles}
                                myPubkey={pubkey}
                                myProfile={myProfile}
                                events={mergedFeedPool}
                                resolveEventById={resolveEventById}
                                getLike={getLike}
                                onLike={handleLike}
                                isBookmarked={isBookmarked}
                                onBookmark={handleBookmark}
                                onOpenProfile={handleOpenProfile}
                                onOpenThread={handleOpenThread}
                                onOpenHashtag={handleOpenHashtag}
                                onOpenArticle={handleOpenArticle}
                                onOpenStream={setOpenStreamEvent}
                                onOpenZaps={handleOpenZaps}
                                onOpenReactions={handleOpenReactions}
                                onOpenReposts={handleOpenReposts}
                                onOpenPollVotes={handleOpenPollVotes}
                                onPublish={prependEvent}
                                publishEvent={publishEvent}
                                onPrepend={prependEvent}
                                onRequestModal={setPanelModal}
                                onDismissModal={() => setPanelModal(null)}
                                getLocalZaps={getLocalZaps}
                                addLocalZap={addLocalZap}
                                getLocalReactions={getLocalReactions}
                                setLocalReaction={setLocalReaction}
                                sendZap={sendZap}
                                defaultZapAmount={zapSettings.amount}
                                defaultZapMsg={zapSettings.msg}
                                onZapFail={reason => showToast(
                                  reason === "no_lud16"  ? "⚡ No lightning address" :
                                  reason === "no_wallet" ? "⚡ No wallet connected" :
                                  `⚡ Zap failed: ${reason}`
                                )}
                                customEmojis={allCustomEmojis}
                                delay={0}
                              />
                            )}
                            {visible.length < filtered.length && (
                              <div style={{ padding: "20px", textAlign: "center" }}>
                                <div style={{ width: 20, height: 20, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto" }} />
                              </div>
                            )}
                          </>
                        );
                      })()
                )}
                {activeNav === "notifications" && (
                  notifLoading && notificationEvents.length === 0
                    ? [0, 1, 2, 3].map(i => <SkelCard key={i} />)
                    : (
                      <>
                        <NotificationsFeed
                          items={notificationEvents.filter(e => !isMuted(e.pubkey)).slice(0, visibleCount)}
                          profiles={profiles}
                          onOpenProfile={handleOpenProfile}
                          onOpenNotification={handleOpenNotification}
                          allEvents={mergedFeedPool}
                        />
                        {visibleCount < notificationEvents.filter(e => !isMuted(e.pubkey)).length && (
                          <div style={{ padding: "20px", textAlign: "center" }}>
                            <div style={{ width: 20, height: 20, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto" }} />
                          </div>
                        )}
                      </>
                    )
                )}
                {activeNav === "zaps" && (
                  <WalletPage
                    wallet={wallet}
                    balance={walletBalance}
                    transactions={walletTxs}
                    loading={walletLoading}
                    error={walletError}
                    onRefresh={refreshWallet}
                    profiles={profiles}
                    onOpenProfile={handleOpenProfile}
                    onOpenTransaction={handleOpenTransaction}
                  />
                )}
              </div>
              {activeNav === "search" && (
                <div style={{ flex: 1, width: "100%", overflow: "hidden", display: "flex" }}>
                  <SearchPage
                    profiles={profiles}
                    onOpenProfile={handleOpenProfile}
                    onOpenThread={handleOpenThread}
                    onOpenHashtag={handleOpenHashtag}
                  />
                </div>
              )}
              {(activeNav === "home" || activeNav === "profile") && !anyPanelOpen && (
                <button
                  type="button"
                  onClick={() => setFloatingCompose(true)}
                  style={{
                    position: "absolute",
                    bottom: isMobile ? "calc(var(--bottom-nav-h) + 16px)" : "20px",
                    right: "18px",
                    width: 52, height: 52,
                    borderRadius: "50%",
                    background: "var(--primary)",
                    color: "white",
                    border: "none",
                    boxShadow: "0 4px 16px rgba(109,40,217,.45)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 26, fontWeight: 300,
                    zIndex: 150,
                    transition: "transform .15s, box-shadow .15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(109,40,217,.55)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 16px rgba(109,40,217,.45)"; }}
                >+
                </button>
              )}
              {floatingCompose && (
                <ComposeSheet
                  profiles={profiles}
                  myPubkey={pubkey}
                  myProfile={myProfile}
                  onPost={text => { publish(text).then(s => s && prependEvent(s)); }}
                  publishEvent={publishEvent}
                  onPrepend={prependEvent}
                  onDismiss={() => { setFloatingCompose(false); setComposeCircle(null); }}
                  circles={circles}
                  initialCircle={composeCircle}
                  customEmojis={allCustomEmojis}
                  blossomServers={blossomServers}
                />
              )}



              <div className={`slide-panel ${openStreamEvent ? "open" : ""}`}>
                {openStreamEvent && (
                  <StreamDetailView
                    event={openStreamEvent}
                    profiles={profiles}
                    pubkey={pubkey}
                    onBack={() => setOpenStreamEvent(null)}
                    onOpenProfile={pk => { setOpenStreamEvent(null); handleOpenProfile(pk); }}
                  />
                )}
              </div>

              <SwipePanel open={navStack.length > 0 && !openStreamEvent && !settingsOpen} onSwipeRight={handleBack}>
                {/* Keep MutedPage mounted when a profile is opened on top of it */}
                {navStack.length >= 2 && !openStreamEvent && !settingsOpen && (() => {
                  const prev = navStack[navStack.length - 2];
                  const top  = navStack[navStack.length - 1];
                  if (prev.type === "muted" && top.type === "profile") {
                    return (
                      <div key="hidden-muted" style={{ display: "none", height: "100%" }}>
                        <MutedPage
                          mutes={mutes}
                          muteEvent={muteEvent}
                          profiles={profiles}
                          onUnmute={handleUnmuteUser}
                          onOpenProfile={handleOpenProfile}
                        />
                      </div>
                    );
                  }
                  if (prev.type !== "circle" || top.type !== "profile") return null;
                  const isOwnCircle = prev.payload.pubkey === pubkey;
                  return (
                    <div key={`hidden-circle-${prev.payload.pubkey}`} style={{ display: "none", height: "100%" }}>
                      <CirclePage
                        key={prev.payload.pubkey}
                        pubkey={prev.payload.pubkey}
                        follows={isOwnCircle ? follows : prev.payload.follows}
                        profiles={profiles}
                        onOpenProfile={handleOpenProfile}
                        onBack={handleBack}
                        myFollows={follows}
                        onFollow={followPk}
                        onUnfollow={unfollowPk}
                      />
                    </div>
                  );
                })()}
                {/* ProfilePage: always rendered when in navStack, CSS-hidden when not top.
                    Keeping the same React element alive preserves scroll position. */}
                {!openStreamEvent && !settingsOpen && (() => {
                  const entries = navStack.map((e, i) => ({ e, i }));
                  const found = [...entries].reverse().find(({ e }) => e.type === "profile");
                  if (!found) return null;
                  const { e: profileEntry, i: idx } = found;
                  const isTop = idx === navStack.length - 1;
                  return (
                    <div
                      key={`profile-${profileEntry.payload}`}
                      style={isTop
                        ? { height: "100%" }
                        : { position: "absolute", inset: 0, visibility: "hidden", pointerEvents: "none", overflow: "hidden" }}
                    >
                      <ProfilePage
                        key={profileEntry.payload}
                        pubkey={profileEntry.payload}
                        myPubkey={pubkey}
                        profiles={profiles}
                        follows={follows}
                        events={mergedFeedPool}
                        isOwn={profileEntry.payload === pubkey}
                        backLabel={backLabel}
                        onBack={handleBack}
                        onOpenProfile={handleOpenProfile}
                        onOpenNote={handleOpenNote}
                        onOpenThread={handleOpenThread}
                        onOpenHashtag={handleOpenHashtag}
                        onOpenZaps={handleOpenZaps}
                        onOpenReactions={handleOpenReactions}
                        onOpenReposts={handleOpenReposts}
                        myProfile={myProfile}
                        onPublish={prependEvent}
                        publishEvent={publishEvent}
                        publishHighlight={publishHighlight}
                        onPrepend={prependEvent}
                        onBookmark={handleBookmark}
                        isBookmarked={isBookmarked}
                        getLocalZaps={getLocalZaps}
                        addLocalZap={addLocalZap}
                        getLocalReactions={getLocalReactions}
                        setLocalReaction={setLocalReaction}
                        sendZap={sendZap}
                        defaultZapAmount={zapSettings.amount}
                        defaultZapMsg={zapSettings.msg}
                        onZapFail={reason => showToast(
                          reason === "no_lud16"  ? "⚡ No lightning address" :
                          reason === "no_wallet" ? "⚡ No wallet connected" :
                          `⚡ Zap failed: ${reason}`
                        )}
                        onRequestModal={setPanelModal}
                        onDismissModal={() => setPanelModal(null)}
                        resolveEventById={resolveEventById}
                        onOpenCircle={handleOpenCircle}
                        onFollow={followPk}
                        onUnfollow={unfollowPk}
                        onOpenPollVotes={handleOpenPollVotes}
                        onOpenArticle={handleOpenArticle}
                        onOpenStream={setOpenStreamEvent}
                        scrollToTopTrigger={isTop && profileEntry.payload === pubkey ? profileScrollTrigger : 0}
                        customEmojis={allCustomEmojis}
                        onEditProfile={profileEntry.payload === pubkey ? handleEditProfile : undefined}
                      />
                    </div>
                  );
                })()}
                {navStack.length > 0 && !openStreamEvent && !settingsOpen && (() => {
                  const top = navStack[navStack.length - 1];

                  if (top.type === "profile") return null; // rendered persistently above

                  if (top.type === "edit-profile") {
                    return (
                      <EditProfilePage
                        key="edit-profile"
                        myProfile={myProfile}
                        myPubkey={pubkey}
                        publishEvent={publishEvent}
                        onBack={handleBack}
                        onSaved={() => showToast("Profile saved")}
                        blossomServers={blossomServers}
                      />
                    );
                  }

                  if (top.type === "muted") {
                    return (
                      <MutedPage
                        key="muted"
                        mutes={mutes}
                        muteEvent={muteEvent}
                        profiles={profiles}
                        onUnmute={handleUnmuteUser}
                        onOpenProfile={handleOpenProfile}
                      />
                    );
                  }

                  if (top.type === "mycircles") {
                    return (
                      <MyCirclesPage
                        key="mycircles"
                        circles={circles}
                        onOpenCircle={circle => pushNav({ type: "circle-detail", payload: { id: circle.id } })}
                        onCreate={createCircle}
                        onDelete={handleDeleteCircle}
                      />
                    );
                  }

                  if (top.type === "circle-detail") {
                    const liveCircle = circles.find(c => c.id === top.payload.id);
                    return (
                      <CircleDetailPage
                        key={`circle-detail-${top.payload.id}`}
                        circle={liveCircle}
                        profiles={profiles}
                        follows={follows}
                        onAddMember={addCircleMember}
                        onRemoveMember={removeCircleMember}
                        onRename={renameCircle}
                        onOpenProfile={handleOpenProfile}
                        onCompose={handleComposeToCircle}
                      />
                    );
                  }

                  if (top.type === "circle") {
                    const isOwnCircle = top.payload.pubkey === pubkey;
                    return (
                      <CirclePage
                        key={top.payload.pubkey}
                        pubkey={top.payload.pubkey}
                        follows={isOwnCircle ? follows : top.payload.follows}
                        profiles={profiles}
                        onOpenProfile={handleOpenProfile}
                        onBack={handleBack}
                        myFollows={follows}
                        onFollow={followPk}
                        onUnfollow={unfollowPk}
                      />
                    );
                  }

                  if (top.type === "article") {
                    return (
                      <ArticleReader
                        key={top.payload.id}
                        event={top.payload}
                        profiles={profiles}
                        onBack={handleBack}
                        onOpenProfile={handleOpenProfile}
                        allEvents={mergedFeedPool}
                        onOpenThread={handleOpenThread}
                        onOpenHashtag={handleOpenHashtag}
                        onOpenZaps={handleOpenZaps}
                        onOpenReactions={handleOpenReactions}
                        onOpenReposts={handleOpenReposts}
                        resolveEventById={resolveEventById}
                        publishHighlight={publishHighlight}
                        myPubkey={pubkey}
                        myProfile={myProfile}
                        publishEvent={publishEvent}
                        onPublish={prependEvent}
                        onPrepend={prependEvent}
                        onBookmark={handleBookmark}
                        isBookmarked={isBookmarked}
                        getLocalZaps={getLocalZaps}
                        addLocalZap={addLocalZap}
                        getLocalReactions={getLocalReactions}
                        setLocalReaction={setLocalReaction}
                        sendZap={sendZap}
                        defaultZapAmount={zapSettings.amount}
                        defaultZapMsg={zapSettings.msg}
                        onZapFail={reason => showToast(
                          reason === "no_lud16"  ? "⚡ No lightning address" :
                          reason === "no_wallet" ? "⚡ No wallet connected" :
                          `⚡ Zap failed: ${reason}`
                        )}
                        customEmojis={allCustomEmojis}
                      />
                    );
                  }

                  if (top.type === "thread") {
                    return (
                      <ThreadView
                        key={top.payload.id}
                        focusedEvent={top.payload}
                        events={mergedFeedPool}
                        profiles={profiles}
                        onBack={handleBack}
                        onOpenProfile={handleOpenProfile}
                        onOpenThread={handleOpenThread}
                        onOpenHashtag={handleOpenHashtag}
                        onOpenZaps={handleOpenZaps}
                        onOpenReactions={handleOpenReactions}
                        onOpenReposts={handleOpenReposts}
                        myPubkey={pubkey}
                        myProfile={myProfile}
                        onPublish={prependEvent}
                        publishEvent={publishEvent}
                        publishHighlight={publishHighlight}
                        onPrepend={prependEvent}
                        onBookmark={handleBookmark}
                        isBookmarked={isBookmarked}
                        getLocalZaps={getLocalZaps}
                        addLocalZap={addLocalZap}
                        getLocalReactions={getLocalReactions}
                        setLocalReaction={setLocalReaction}
                        onRequestModal={setPanelModal}
                        onDismissModal={() => setPanelModal(null)}
                        sendZap={sendZap}
                        defaultZapAmount={zapSettings.amount}
                        defaultZapMsg={zapSettings.msg}
                        onZapFail={reason => showToast(
                          reason === "no_lud16"  ? "⚡ No lightning address" :
                          reason === "no_wallet" ? "⚡ No wallet connected" :
                          `⚡ Zap failed: ${reason}`
                        )}                        resolveEventById={resolveEventById}
                        onOpenPollVotes={handleOpenPollVotes}
                        customEmojis={allCustomEmojis}
                      />
                    );
                  }

                  if (top.type === "goal") {
                    return (
                      <ZapGoalPage
                        key={top.payload.id}
                        event={top.payload}
                        profiles={profiles}
                        myPubkey={pubkey}
                        myProfile={myProfile}
                        onBack={handleBack}
                        onOpenProfile={handleOpenProfile}
                        onOpenThread={handleOpenThread}
                        onOpenHashtag={handleOpenHashtag}
                        onOpenZaps={handleOpenZaps}
                        onOpenReactions={handleOpenReactions}
                        onOpenReposts={handleOpenReposts}
                        onPublish={prependEvent}
                        publishEvent={publishEvent}
                        onPrepend={prependEvent}
                        onBookmark={handleBookmark}
                        isBookmarked={isBookmarked}
                        getLocalZaps={getLocalZaps}
                        addLocalZap={addLocalZap}
                        getLocalReactions={getLocalReactions}
                        setLocalReaction={setLocalReaction}
                        onRequestModal={setPanelModal}
                        onDismissModal={() => setPanelModal(null)}
                        sendZap={sendZap}
                        defaultZapAmount={zapSettings.amount}
                        defaultZapMsg={zapSettings.msg}
                        onZapFail={reason => showToast(
                          reason === "no_lud16"  ? "⚡ No lightning address" :
                          reason === "no_wallet" ? "⚡ No wallet connected" :
                          `⚡ Zap failed: ${reason}`
                        )}
                        customEmojis={allCustomEmojis}
                      />
                    );
                  }

                  if (top.type === "calendar") {
                    return (
                      <EventDetailView
                        key={top.payload.id}
                        event={top.payload}
                        profiles={profiles}
                        pubkey={pubkey}
                        myProfile={myProfile}
                        events={mergedFeedPool}
                        publishEvent={publishEvent}
                        onBack={handleBack}
                        onOpenProfile={handleOpenProfile}
                        onOpenThread={handleOpenThread}
                        onOpenZaps={handleOpenZaps}
                        onOpenReactions={handleOpenReactions}
                        onOpenReposts={handleOpenReposts}
                        onPublish={prependEvent}
                        onPrepend={prependEvent}
                        onBookmark={handleBookmark}
                        isBookmarked={isBookmarked}
                        getLocalZaps={getLocalZaps}
                        addLocalZap={addLocalZap}
                        getLocalReactions={getLocalReactions}
                        setLocalReaction={setLocalReaction}
                        onRequestModal={setPanelModal}
                        onDismissModal={() => setPanelModal(null)}
                        sendZap={sendZap}
                        defaultZapAmount={zapSettings.amount}
                        defaultZapMsg={zapSettings.msg}
                        onZapFail={reason => showToast(
                          reason === "no_lud16"  ? "⚡ No lightning address" :
                          reason === "no_wallet" ? "⚡ No wallet connected" :
                          `⚡ Zap failed: ${reason}`
                        )}
                        customEmojis={allCustomEmojis}
                      />
                    );
                  }

                  if (top.type === "poll-votes") {
                    return (
                      <PollVotesScreen
                        key={top.payload.event.id}
                        options={top.payload.options}
                        voteEvents={top.payload.voteEvents}
                        isZapPoll={top.payload.isZapPoll}
                        profiles={profiles}
                        onBack={handleBack}
                        onOpenProfile={handleOpenProfile}
                      />
                    );
                  }

                  if (top.type === "zaps") {
                    return (
                      <ZapsScreen
                        key={top.payload.eventId}
                        eventId={top.payload.eventId}
                        zaps={top.payload.zaps}
                        profiles={profiles}
                        onBack={handleBack}
                        onOpenProfile={handleOpenProfile}
                      />
                    );
                  }

                  if (top.type === "reactions") {
                    return (
                      <ReactionsScreen
                        key={top.payload.eventId}
                        eventId={top.payload.eventId}
                        reactions={top.payload.reactions}
                        profiles={profiles}
                        onBack={handleBack}
                        onOpenProfile={handleOpenProfile}
                      />
                    );
                  }

                  if (top.type === "reposts") {
                    return (
                      <RepostsScreen
                        key={top.payload.eventId}
                        eventId={top.payload.eventId}
                        reposts={top.payload.reposts}
                        profiles={profiles}
                        onBack={handleBack}
                        onOpenProfile={handleOpenProfile}
                        onOpenThread={handleOpenThread}
                    allEvents={mergedFeedPool}
                    resolveEventById={resolveEventById}
                      />
                    );
                  }

                  if (top.type === "note") {
                    const ev = top.payload;
                    const isQ = isQuoteRepost(ev);
                    const repostedId = ev.tags.find(t => t[0] === "e")?.[1];
                    const repostedEv = repostedId ? mergedFeedPool.find(e => e.id === repostedId) : null;
                    return (
                      <div className="slide-panel-scroll">
                        <div className="panel-bar">
                          <button type="button" className="back-btn" onClick={handleBack}><Bk s={16} /></button>
                          <img src="/logo.png" alt="Circl" className="panel-bar-logo" style={{ height: 22, width: "auto" }} />
                        </div>
                        <div style={{ padding: "20px 20px 80px" }}>
                          <div className="note-card" style={{ borderRadius: 14, border: "1px solid var(--border)", marginBottom: 16 }}>
                            <div className="note-inner">
                              <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => handleOpenProfile(ev.pubkey)} role="presentation">
                                <Avatar pk={ev.pubkey} profiles={profiles} size={36} />
                              </div>
                              <div className="note-body">
                                <div className="note-meta">
                                  <span className="note-name" style={{ cursor: "pointer" }} onClick={() => handleOpenProfile(ev.pubkey)} role="presentation">{displayName(ev.pubkey, profiles)}</span>
                                  <span className="note-time">{relativeTime(ev.created_at)}</span>
                                </div>
                                {isQ && ev.content && (
                                  <NoteContent
                                    content={ev.content.replace(/\nnostr:\S+/g, "").trim()}
                                    tags={ev.tags}
                                    profiles={profiles}
                                    onOpenProfile={handleOpenProfile}
                                    allEvents={mergedFeedPool}
                                    onOpenThread={handleOpenThread}
                                    resolveEventById={resolveEventById}
                                  />
                                )}
                                {!isQ && (
                                  <NoteContent
                                    content={ev.content}
                                    tags={ev.tags}
                                    profiles={profiles}
                                    onOpenProfile={handleOpenProfile}
                                    allEvents={mergedFeedPool}
                                    onOpenThread={handleOpenThread}
                                    resolveEventById={resolveEventById}
                                  />
                                )}
                                {isQ && repostedEv && (() => {
                                  const isRepostedPoll = repostedEv.kind === 1068 || repostedEv.kind === 6969;
                                  return (
                                    <div
                                      style={{ border: "1px solid var(--border)", borderRadius: 10,
                                        padding: "10px 12px", background: "var(--surface)", marginTop: 4, cursor: "pointer" }}
                                      onClick={() => handleOpenThread(repostedEv)}
                                      role="presentation"
                                    >
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                                        <Avatar pk={repostedEv.pubkey} profiles={profiles} size={20} />
                                        <span style={{ fontSize: 12, fontWeight: 500 }}>{displayName(repostedEv.pubkey, profiles)}</span>
                                        <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto" }}>{relativeTime(repostedEv.created_at)}</span>
                                        {isRepostedPoll && <span className="poll-badge" style={{ marginLeft: 4 }}>{repostedEv.kind === 6969 ? "⚡ Zap Poll" : "Poll"}</span>}
                                      </div>
                                      <NoteContent
                                        content={repostedEv.content}
                                        tags={repostedEv.tags}
                                        profiles={profiles}
                                        onOpenProfile={handleOpenProfile}
                                        allEvents={mergedFeedPool}
                                        onOpenThread={handleOpenThread}
                                        resolveEventById={resolveEventById}
                                        allowEmbeds={!isRepostedPoll}
                                        className="note-text"
                                        style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}
                                      />
                                      {isRepostedPoll && (
                                        <PollInline
                                          event={repostedEv}
                                          myPubkey={pubkey}
                                          sendZap={sendZap}
                                          defaultZapAmount={zapSettings.amount}
                                          defaultZapMsg={zapSettings.msg}
                                          onZapFail={reason => showToast(
                                            reason === "no_lud16"  ? "⚡ No lightning address" :
                                            reason === "no_wallet" ? "⚡ No wallet connected" :
                                            `⚡ Zap failed: ${reason}`
                                          )}
                                          profiles={profiles}
                                          publishEvent={publishEvent}
                                          onOpenVotes={handleOpenPollVotes}
                                        />
                                      )}
                                    </div>
                                  );
                                })()}
                                <NoteActions
                                  event={ev}
                                  profiles={profiles}
                                  myPubkey={pubkey}
                                  myProfile={myProfile}
                                  events={mergedFeedPool}
                                  onOpenThread={handleOpenThread}
                                  onOpenZaps={handleOpenZaps}
                                  onOpenReactions={handleOpenReactions}
                                  onOpenReposts={handleOpenReposts}
                                  onPublish={prependEvent}
                                  publishEvent={publishEvent}
                                  onPrepend={prependEvent}
                                  onBookmark={handleBookmark}
                                  isBookmarked={isBookmarked}
                                  getLocalZaps={getLocalZaps}
                                  addLocalZap={addLocalZap}
                                  getLocalReactions={getLocalReactions}
                                  setLocalReaction={setLocalReaction}
                                  onRequestModal={setPanelModal}
                                  onDismissModal={() => setPanelModal(null)}
                                  sendZap={sendZap}
                                  defaultZapAmount={zapSettings.amount}
                                  defaultZapMsg={zapSettings.msg}
                                  onZapFail={reason => showToast(
                                    reason === "no_lud16"  ? "⚡ No lightning address" :
                                    reason === "no_wallet" ? "⚡ No wallet connected" :
                                    `⚡ Zap failed: ${reason}`
                                  )}
                                  customEmojis={allCustomEmojis}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (top.type === "hashtag") {
                    return (
                      <HashtagFeed
                        key={top.payload}
                        hashtag={top.payload}
                        profiles={profiles}
                        onBack={handleBack}
                        onOpenProfile={handleOpenProfile}
                        onOpenThread={handleOpenThread}
                        onOpenHashtag={handleOpenHashtag}
                        myPubkey={pubkey}
                        myProfile={myProfile}
                        onBookmark={handleBookmark}
                        isBookmarked={isBookmarked}
                        getLocalZaps={getLocalZaps}
                        addLocalZap={addLocalZap}
                        getLocalReactions={getLocalReactions}
                        setLocalReaction={setLocalReaction}
                        publishEvent={publishEvent}
                        onPrepend={prependEvent}
                        onOpenZaps={handleOpenZaps}
                        onOpenReactions={handleOpenReactions}
                        onOpenReposts={handleOpenReposts}
                        resolveEventById={resolveEventById}
                        sendZap={sendZap}
                        defaultZapAmount={zapSettings.amount}
                        defaultZapMsg={zapSettings.msg}
                        onZapFail={reason => showToast(
                          reason === "no_lud16"  ? "⚡ No lightning address" :
                          reason === "no_wallet" ? "⚡ No wallet connected" :
                          `⚡ Zap failed: ${reason}`
                        )}
                        customEmojis={allCustomEmojis}
                      />
                    );
                  }

                  if (top.type === "transaction") {
                    return (
                      <TxDetailPage
                        key={top.payload.payment_hash}
                        tx={top.payload}
                        profiles={profiles}
                        onBack={handleBack}
                        onOpenProfile={handleOpenProfile}
                        onOpenThread={handleOpenThread}
                      />
                    );
                  }

                  return null;
                })()}
              </SwipePanel>

              <SwipePanel open={settingsOpen} onSwipeRight={() => setSettingsOpen(false)}>
                <SettingsPage
                  onBack={() => setSettingsOpen(false)}
                  dark={dark}
                  toggleDark={toggleDark}
                  onLogout={() => { logout(); setSettingsOpen(false); }}
                  pubkey={pubkey}
                  wallet={wallet}
                  onWalletConnected={data => {
                    saveWallet(data);
                    showToast(data.lightning_address ? `⚡ ${data.lightning_address} connected!` : "⚡ Wallet connected!");
                  }}
                  onWalletDisconnect={() => {
                    disconnectWallet();
                    showToast("Wallet disconnected");
                  }}
                  zapSettings={zapSettings}
                  onSaveZapSettings={saveZapSettings}
                  textSize={textSize}
                  onTextSizeChange={setTextSize}
                  signAndPublish={signAndPublish}
                  customEmojis={customEmojis}
                  sets={customEmojiSets}
                  addEmoji={addEmoji}
                  removeEmoji={removeEmoji}
                  addSet={addEmojiSet}
                  removeSet={removeEmojiSet}
                  customEmojiLoading={customEmojiLoading}
                  blossomServers={blossomServers}
                  saveBlossomServers={saveBlossomServers}
                />
              </SwipePanel>


            </div>

            <div className="right-panel">
              <RelaysCard profilePubkey={viewedProfilePubkey} />
              {topEntry?.type === "thread" && (
                <ParticipantsCard
                  event={topEntry.payload}
                  profiles={profiles}
                  onOpenProfile={handleOpenProfile}
                />
              )}
            </div>
          </div>

        </div>
      </div>

      <div className="bottom-nav">
        <div className="bottom-nav-inner">
          {navItems.slice(0, 3).map(item => (
            <button key={item.id} type="button" className={`bottom-nav-item ${!settingsOpen && activeNav === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}>
              <div style={{ position: "relative", display: "inline-flex" }}>
                {item.NavIcon}
                {item.id === "notifications" && hasUnread && <div className="notif-unread-dot" />}
              </div>
            </button>
          ))}

          <button
            type="button"
            className={`bottom-profile-btn${!settingsOpen && activeNav === "profile" ? " active" : ""}`}
            onClick={() => {
              if (activeNav === "profile" && !settingsOpen && navStack.length <= 1) setProfileScrollTrigger(t => t + 1);
              navigate("profile");
            }}
          >
            <div className={`bottom-profile-av${!settingsOpen && activeNav === "profile" ? " active" : ""}`}>
              {myProfile?.picture
                ? <img src={myProfile.picture} alt="" onError={e => { e.target.style.display = "none"; }} />
                : avatarInitial(pubkey, { [pubkey]: myProfile })}
            </div>
          </button>

          {navItems.slice(3).map(item => (
            <button key={item.id} type="button" className={`bottom-nav-item ${!settingsOpen && activeNav === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}>
              {item.NavIcon}
            </button>
          ))}

          <button
            type="button"
            className={`bottom-settings-btn${settingsOpen || moreOpen || topEntry?.type === "muted" || topEntry?.type === "mycircles" || topEntry?.type === "circle-detail" ? " active" : ""}`}
            onClick={() => setMoreOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>
      </div>

      {panelModal && panelModal}

      {moreOpen && (
        <div className="overlay" onClick={() => setMoreOpen(false)}>
          <div className="action-sheet" onClick={e => e.stopPropagation()}>
            <div className="action-sheet-handle" />
            <button className="action-sheet-btn" onClick={() => { setMoreOpen(false); clearNav(); setSettingsOpen(false); setActiveNav(null); pushNav({ type: "muted" }); }}>
              <div className="action-sheet-btn-icon">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/>
                  <line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
              </div>
              Muted
            </button>
            <button className="action-sheet-btn" onClick={() => { setMoreOpen(false); clearNav(); setSettingsOpen(false); setActiveNav(null); pushNav({ type: "mycircles" }); }}>
              <div className="action-sheet-btn-icon">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="3" />
                  <path d="M3 18c0-3 2.7-5 6-5s6 2 6 5" />
                  <circle cx="18" cy="7" r="2" />
                  <path d="M20 14c1.2.6 2 1.7 2 3" />
                </svg>
              </div>
              My Circles
            </button>
            <button className="action-sheet-btn" onClick={() => { setMoreOpen(false); clearNav(); setSettingsOpen(true); }}>
              <div className="action-sheet-btn-icon">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              Settings
            </button>
            <button className="action-sheet-cancel" onClick={() => setMoreOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className={`toast ${toast.show ? "show" : ""}`}>{toast.msg}</div>
    </>
    </NavigationContext.Provider>
  );
}
