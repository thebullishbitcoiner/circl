import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import { displayName, relativeTime, zapCommentFromKind9735, parseArticle, fmtSats, parseBolt11Msats } from "../utils.js";
import { getNotificationSummary } from "../hooks/useNotifications.js";

const AV_SIZE = 36;
const MAX_AV = 4;
const AV_OVERLAP = 10;
const ROW_PAD = 18;

function groupItems(items) {
  const seen = new Map();
  const result = [];
  for (const ev of items) {
    const targetId = ev.tags?.find(t => t[0] === "e")?.[1];
    if ((ev.kind === 7 || ev.kind === 6) && targetId) {
      const key = `${ev.kind}:${targetId}`;
      if (seen.has(key)) {
        result[seen.get(key)].actors.push(ev);
      } else {
        seen.set(key, result.length);
        result.push({ type: "group", kind: ev.kind, targetId, actors: [ev], latestAt: ev.created_at });
      }
    } else {
      result.push({ type: "single", ev });
    }
  }
  return result;
}

function AvatarStack({ pubkeys, profiles, onOpenProfile }) {
  const shown = pubkeys.slice(0, MAX_AV);
  return (
    <div style={{ display: "flex", flexShrink: 0 }}>
      {shown.map((pk, i) => (
        <div key={pk}
          style={{ marginLeft: i === 0 ? 0 : -AV_OVERLAP, zIndex: shown.length - i, borderRadius: "50%", border: "2px solid var(--bg)", overflow: "hidden", flexShrink: 0, cursor: "pointer" }}
          onClick={e => { e.stopPropagation(); onOpenProfile?.(pk); }}
        >
          <Avatar pk={pk} profiles={profiles} size={AV_SIZE} />
        </div>
      ))}
    </div>
  );
}

function ActorNames({ actors, profiles, onOpenProfile }) {
  const shown = actors.slice(0, 2);
  const extra = actors.length - shown.length;
  return (
    <>
      {shown.map((a, i) => (
        <span key={a.pubkey + a.id}>
          {i > 0 && <span className="notif-action">{extra > 0 ? ", " : " and "}</span>}
          <span className="notif-name-btn"
            role="button" tabIndex={0}
            onClick={e => { e.stopPropagation(); onOpenProfile?.(a.pubkey); }}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenProfile?.(a.pubkey); } }}>
            {displayName(a.pubkey, profiles)}
          </span>
        </span>
      ))}
      {extra > 0 && <span className="notif-action"> and {extra} other{extra > 1 ? "s" : ""}</span>}
    </>
  );
}

function NotePreview({ ev, profiles }) {
  if (!ev) return null;
  if (ev.kind === 30023) {
    const { title, summary } = parseArticle(ev);
    const text = (title || summary || "").trim();
    return text ? <div className="notif-preview">{text}</div> : null;
  }
  if (typeof ev.content !== "string" || !ev.content.trim()) return null;
  return (
    <div className="notif-preview">
      <NoteContent content={ev.content} profiles={profiles} allEvents={[]} allowEmbeds={false} className="notif-note-text" />
    </div>
  );
}

const timeStyle = { position: "absolute", top: 14, right: ROW_PAD, fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap" };

export default function NotificationsFeed({ items, profiles, onOpenProfile, onOpenNotification, allEvents }) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">You&apos;re all caught up</div>
        <div className="empty-state-sub">Mentions, replies, reactions, zaps, and reposts of your notes from the last 30 days show up here</div>
      </div>
    );
  }

  const grouped = groupItems(items);
  const evById = new Map((allEvents || []).map(e => [e.id, e]));

  return (
    <>
      {grouped.map((entry, i) => {
        const delay = { animationDelay: `${Math.min(i, 12) * 0.03}s` };
        const rowStyle = { ...delay, position: "relative", display: "flex", flexDirection: "column", paddingRight: ROW_PAD + 44 };

        if (entry.type === "group") {
          const { kind, targetId, actors, latestAt } = entry;
          const targetEv = evById.get(targetId);
          const pubkeys = [...new Set(actors.map(a => a.pubkey))];
          const emoji = kind === 7 ? (actors[0].content === "+" || !actors[0].content ? "💜" : actors[0].content) : null;
          const verb = kind === 7 ? `reacted ${emoji} to your note` : "reposted your note";
          const single = pubkeys.length === 1;

          return (
            <div key={`${kind}:${targetId}`} className="notif-row" style={rowStyle}
              onClick={() => onOpenNotification?.(actors[0])} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenNotification?.(actors[0]); } }}
            >
              <span style={timeStyle}>{relativeTime(latestAt)}</span>
              {single ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
                    <AvatarStack pubkeys={pubkeys} profiles={profiles} onOpenProfile={onOpenProfile} />
                  </div>
                  <div className="notif-text" style={{ margin: 0 }}>
                    <ActorNames actors={actors} profiles={profiles} onOpenProfile={onOpenProfile} />
                    {" "}<span className="notif-action">{verb}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div onClick={e => e.stopPropagation()} style={{ marginBottom: 6 }}>
                    <AvatarStack pubkeys={pubkeys} profiles={profiles} onOpenProfile={onOpenProfile} />
                  </div>
                  <div className="notif-text">
                    <ActorNames actors={actors} profiles={profiles} onOpenProfile={onOpenProfile} />
                    {" "}<span className="notif-action">{verb}</span>
                  </div>
                </>
              )}
              <NotePreview ev={targetEv} profiles={profiles} />
            </div>
          );
        }

        const { ev } = entry;
        const { headline, detail } = getNotificationSummary(ev);

        let preview = null;
        if (ev.kind === 9735) {
          const bolt11 = ev.tags?.find(t => t[0] === "bolt11")?.[1];
          const msats = parseBolt11Msats(bolt11);
          const comment = zapCommentFromKind9735(ev);
          const satsStr = fmtSats(msats);
          const satsLabel = msats === 1000 ? "sat" : "sats";
          preview = (
            <div className="notif-preview notif-zap-preview">
              <span className="notif-zap-amt">{satsStr}</span>
              <span className="notif-action"> {satsLabel}</span>
              {comment && <span className="notif-action"> · {comment}</span>}
            </div>
          );
        } else if (ev.kind === 1 || ev.kind === 30023) {
          preview = <NotePreview ev={ev} profiles={profiles} />;
        }

        return (
          <div key={ev.id} className="notif-row" style={rowStyle}
            onClick={() => onOpenNotification?.(ev)} role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenNotification?.(ev); } }}
          >
            <span style={timeStyle}>{relativeTime(ev.created_at)}</span>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
                <AvatarStack pubkeys={[ev.pubkey]} profiles={profiles} onOpenProfile={onOpenProfile} />
              </div>
              <div className="notif-text" style={{ margin: 0 }}>
                <span className="notif-name-btn"
                  role="button" tabIndex={0}
                  onClick={e => { e.stopPropagation(); onOpenProfile?.(ev.pubkey); }}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenProfile?.(ev.pubkey); } }}>
                  {displayName(ev.pubkey, profiles)}
                </span>
                <span className="notif-action"> {headline}{detail ? ` · ${detail}` : ""}</span>
              </div>
            </div>
            {preview}
          </div>
        );
      })}
    </>
  );
}
