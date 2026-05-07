import { useState, useEffect, useRef } from "react";
import Avatar from "./Avatar.jsx";
import ArticleBody from "./ArticleBody.jsx";
import ProfileText from "./ProfileText.jsx";
import { Bk, Hi, Bi, Sh, Cl, Ri, Zi } from "./icons.jsx";
import { displayName, nip05OrNpub, relativeTime, parseArticle, avatarUrl } from "../utils.js";
import { nip19 } from "../utils.js";

export default function ArticleReader({
  event,
  profiles,
  liked,
  bookmarked,
  likeCount,
  onLike,
  onBookmark,
  onBack,
  onOpenProfile,
  allEvents = [],
  onOpenThread,
  resolveEventById,
}) {
  const [progress, setProgress] = useState(0);
  const ref = useRef(null);
  const art  = parseArticle(event);
  const name = displayName(event.pubkey, profiles);
  const about = profiles?.[event.pubkey]?.about || "";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fn = () => setProgress(Math.min((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100 || 0, 100));
    el.addEventListener("scroll", fn);
    return () => el.removeEventListener("scroll", fn);
  }, []);

  return (
    <div ref={ref} className="slide-panel-scroll">
      <div className="read-progress" style={{ width: `${progress}%` }} />
      <div className="panel-bar">
        <button className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span className="panel-bar-logo">Circl</span>
        <div style={{ display: "flex", gap: 3 }}>
          <button className={`icon-btn ${liked ? "r-liked" : ""}`} onClick={() => onLike(event.id)}><Hi f={liked} /></button>
          <button className={`icon-btn ${bookmarked ? "r-saved" : ""}`} onClick={() => onBookmark(event)}><Bi f={bookmarked} /></button>
          <button className="icon-btn"><Sh /></button>
        </div>
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
          <div className="reader-title">{art.title}</div>
          {art.summary && <div className="reader-summary">{art.summary}</div>}
          {art.hashtags?.length ? (
            <div className="reader-hashtags">
              {art.hashtags.map(t => <span key={t}>#{t}</span>)}
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
            <div className="meta-sep" />
            <span className="meta-pill"><Cl />{art.readtime}</span>
            <span className="meta-pill">{relativeTime(event.created_at)} ago</span>
          </div>
        </div>
        <ArticleBody
          content={event.content}
          profiles={profiles}
          onOpenProfile={onOpenProfile}
          allEvents={allEvents}
          onOpenThread={onOpenThread}
          resolveEventById={resolveEventById}
        />
        <div className="reader-footer">
          <div className="reactions-row">
            <span className="reactions-label">Reactions</span>
            <button className={`rx-btn rx-liked ${liked ? "rx-active" : ""}`} onClick={() => onLike(event.id)}><Hi f={liked} />{likeCount}</button>
            <button className="rx-btn"><Ri /> Reply</button>
            <button className="rx-btn"><Zi /> Zap</button>
            <button className={`rx-btn ${bookmarked ? "rx-active" : ""}`} onClick={() => onBookmark(event)} style={{ marginLeft: "auto" }}><Bi f={bookmarked} />{bookmarked ? "Saved" : "Save"}</button>
          </div>
          <div className="author-card" style={{ cursor: "pointer" }} onClick={() => onOpenProfile?.(event.pubkey)}>
            <div className="author-card-av"><Avatar pk={event.pubkey} profiles={profiles} size={44} /></div>
            <div>
              <div className="author-card-label">Written by</div>
              <div className="author-card-name">{name}</div>
              {about && <ProfileText className="author-card-bio" text={about} />}
              <button className="follow-author-btn">Follow on Nostr</button>
            </div>
          </div>
          <div><div className="event-id-label">Nostr Event ID</div><div className="event-id">{nip19.noteEncode(event.id)}</div></div>
        </div>
      </div>
    </div>
  );
}
