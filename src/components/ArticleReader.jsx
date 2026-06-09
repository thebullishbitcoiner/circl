import { useState, useEffect, useRef } from "react";
import Avatar from "./Avatar.jsx";
import ArticleBody from "./ArticleBody.jsx";
import HighlightPopover from "./HighlightPopover.jsx";
import HighlightSheet from "./HighlightSheet.jsx";
import NoteActions from "./NoteActions.jsx";
import { Bk, Bi } from "./icons.jsx";
import { displayName, nip05OrNpub, parseArticle } from "../utils.js";
import { nip19 } from "../utils.js";

export default function ArticleReader({
  event,
  profiles,
  onBack,
  onOpenProfile,
  allEvents = [],
  onOpenThread,
  onOpenHashtag,
  onOpenZaps,
  onOpenReactions,
  onOpenReposts,
  resolveEventById,
  publishHighlight,
  myPubkey,
  myProfile,
  publishEvent,
  onPublish,
  onPrepend,
  onBookmark,
  isBookmarked,
  getLocalZaps,
  addLocalZap,
  getLocalReactions,
  setLocalReaction,
  sendZap,
  defaultZapAmount,
  defaultZapMsg,
  onZapFail,
  customEmojis = [],
}) {
  const [highlightDraft, setHighlightDraft] = useState(null);
  const ref = useRef(null);
  const bodyRef = useRef(null);
  const progressBarRef = useRef(null);
  const art  = parseArticle(event);
  const name = displayName(event.pubkey, profiles);

  useEffect(() => {
    const el = ref.current;
    const bar = progressBarRef.current;
    if (!el || !bar) return;
    const fn = () => {
      const pct = Math.min((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100 || 0, 100);
      bar.style.width = `${pct}%`;
    };
    el.addEventListener("scroll", fn, { passive: true });
    return () => el.removeEventListener("scroll", fn);
  }, []);

  return (
    <>
    <div ref={ref} className="slide-panel-scroll">
      <div ref={progressBarRef} className="read-progress" />
      <div className="panel-bar">
        <button className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <button className={`icon-btn ${isBookmarked?.(event) ? "r-saved" : ""}`} style={{ marginLeft: "auto" }} onClick={() => onBookmark?.(event)}><Bi f={!!isBookmarked?.(event)} /></button>
      </div>
      <div className="reader-hero">
        {art.image ? (
          <img className="reader-hero-image" src={art.image} alt={art.title} loading="eager" decoding="async" referrerPolicy="no-referrer" />
        ) : (
          <div className="reader-hero-glyph">✦</div>
        )}
      </div>
      <div className="reader-content">
        <div className="reader-header">
          <div className="r-article-dateline">
            {new Date(event.created_at * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {(() => { const c = event.tags?.find(t => t[0] === "client")?.[1]; return c ? <><span className="meta-dot"> · </span>via {c}</> : null; })()}
          </div>
          <div className="reader-title">{art.title}</div>
          {art.summary && <div className="reader-summary">{art.summary}</div>}
          {art.hashtags?.length ? (
            <div className="reader-hashtags">
              {art.hashtags.map(t => <span key={t} onClick={() => onOpenHashtag?.(t)} style={{ cursor: "pointer" }}>#{t}</span>)}
            </div>
          ) : null}
          <div className="reader-meta">
            <div className="r-author-row" onClick={() => onOpenProfile?.(event.pubkey)} style={{ cursor: "pointer" }}>
              <div className="r-av"><Avatar pk={event.pubkey} profiles={profiles} size={34} /></div>
              <div>
                <div className="r-author-name">{name}</div>
                <div className="r-author-npub">{nip05OrNpub(event.pubkey, profiles)}</div>
              </div>
            </div>
          </div>
        </div>
        <div ref={bodyRef} style={{ position: "relative" }}>
          {publishHighlight && (
            <HighlightPopover
              sourceEvent={event}
              containerRef={bodyRef}
              onHighlight={draft => setHighlightDraft(draft)}
            />
          )}
          <ArticleBody
            content={event.content}
            profiles={profiles}
            onOpenProfile={onOpenProfile}
            allEvents={allEvents}
            onOpenThread={onOpenThread}
            resolveEventById={resolveEventById}
          />
        </div>
        <div style={{ padding: "8px 0 24px" }}>
          <NoteActions
            event={event}
            profiles={profiles}
            myPubkey={myPubkey}
            myProfile={myProfile}
            events={allEvents}
            onOpenThread={onOpenThread}
            onOpenZaps={onOpenZaps}
            onOpenReactions={onOpenReactions}
            onOpenReposts={onOpenReposts}
            onPublish={onPublish}
            publishEvent={publishEvent}
            onPrepend={onPrepend}
            onBookmark={onBookmark}
            isBookmarked={isBookmarked}
            getLocalZaps={getLocalZaps}
            addLocalZap={addLocalZap}
            getLocalReactions={getLocalReactions}
            setLocalReaction={setLocalReaction}
            sendZap={sendZap}
            defaultZapAmount={defaultZapAmount}
            defaultZapMsg={defaultZapMsg}
            onZapFail={onZapFail}
            customEmojis={customEmojis}
          />
        </div>
        <div style={{ padding: "0 0 24px" }}>
          <div className="event-id-label">Nostr Event ID</div>
          <div className="event-id">{nip19.noteEncode(event.id)}</div>
        </div>
      </div>
    </div>
    {highlightDraft && (
      <HighlightSheet
        text={highlightDraft.text}
        context={highlightDraft.context}
        sourceEvent={highlightDraft.sourceEvent}
        publishHighlight={publishHighlight}
        onPrepend={onPrepend}
        onDismiss={() => setHighlightDraft(null)}
      />
    )}
    </>
  );
}
