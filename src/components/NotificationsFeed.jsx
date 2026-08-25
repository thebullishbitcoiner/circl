import { useMemo } from "react";
import Avatar from "./Avatar.jsx";
import NoteContent from "./NoteContent.jsx";
import { displayName, relativeTime, zapCommentFromKind9735, zapperPubkeyFromKind9735, parseArticle, fmtSats, parseBolt11Msats } from "../utils.js";
import { getNotificationSummary } from "../hooks/useNotifications.js";
import { eventStore } from "../nostr.js";
import useProfiles from "../hooks/useProfiles.js";

function resolveEmoji(content, tags) {
  const m = content?.match(/^:([a-zA-Z0-9_]+):$/);
  if (!m) return content;
  const url = tags?.find(t => t[0] === "emoji" && t[1] === m[1])?.[2];
  return url ? { url, name: content } : content;
}

function EmojiOrText({ value }) {
  if (!value) return null;
  if (typeof value === "object" && value.url) {
    return <img src={value.url} alt={value.name} className="note-custom-emoji" style={{ height: "1.1em", verticalAlign: "middle" }} />;
  }
  return <>{value}</>;
}

const AV_SIZE = 36;
const MAX_AV = 4;
const AV_OVERLAP = 10;
const ROW_PAD = 18;

function groupItems(items) {
  const seen = new Map();
  const result = [];
  for (const ev of items) {
    const eTags = ev.tags?.filter(t => t[0] === "e") ?? [];
    const targetId = eTags[eTags.length - 1]?.[1];
    if ((ev.kind === 7 || ev.kind === 6 || ev.kind === 1018) && targetId) {
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
  const text = (ev.content || "").trim();
  if (!text) return null;
  return (
    <div className="notif-preview">
      <NoteContent content={text} tags={ev.tags} profiles={profiles} allEvents={[]} allowEmbeds={false} className="notif-note-text" collapsible />
    </div>
  );
}

const timeStyle = { fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap", flexShrink: 0, marginLeft: "auto", paddingLeft: 8 };

export default function NotificationsFeed({ items, profiles: propProfiles, onOpenProfile, onOpenNotification, allEvents }) {
  const actorPks = useMemo(() => {
    const pks = new Set();
    for (const ev of items) {
      pks.add(ev.pubkey);
      if (ev.kind === 9735) {
        const zapper = zapperPubkeyFromKind9735(ev);
        if (zapper) pks.add(zapper);
      }
    }
    return [...pks].filter(Boolean);
  }, [items]);
  const { profiles: localProfiles } = useProfiles({ pubkeys: actorPks });
  const profiles = useMemo(() => ({ ...propProfiles, ...localProfiles }), [propProfiles, localProfiles]);

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
        const rowStyle = { ...delay, display: "flex", flexDirection: "column" };

        if (entry.type === "group") {
          const { kind, targetId, actors, latestAt } = entry;
          const targetEv = evById.get(targetId);
          const pubkeys = [...new Set(actors.map(a => a.pubkey))];
          const rawEmoji = kind === 7 ? (actors[0].content === "+" || !actors[0].content ? "💜" : actors[0].content) : null;
          const emoji = rawEmoji ? resolveEmoji(rawEmoji, actors[0].tags) : null;
          const single = pubkeys.length === 1;

          return (
            <div key={`${kind}:${targetId}`} className="notif-row" style={rowStyle}
              onClick={() => onOpenNotification?.(actors[0])} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenNotification?.(actors[0]); } }}
            >
              {single ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
                    <AvatarStack pubkeys={pubkeys} profiles={profiles} onOpenProfile={onOpenProfile} />
                  </div>
                  <div className="notif-text" style={{ margin: 0 }}>
                    <ActorNames actors={actors} profiles={profiles} onOpenProfile={onOpenProfile} />
                    {" "}<span className="notif-action">
                      {kind === 7 ? <>reacted <EmojiOrText value={emoji} /> to your note</> : kind === 1018 ? "voted in your poll" : "reposted your note"}
                    </span>
                  </div>
                  <span style={timeStyle}>{relativeTime(latestAt)}</span>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }} onClick={e => e.stopPropagation()}>
                    <AvatarStack pubkeys={pubkeys} profiles={profiles} onOpenProfile={onOpenProfile} />
                    <span style={{ ...timeStyle, marginLeft: "auto" }}>{relativeTime(latestAt)}</span>
                  </div>
                  <div className="notif-text">
                    <ActorNames actors={actors} profiles={profiles} onOpenProfile={onOpenProfile} />
                    {" "}<span className="notif-action">
                      {kind === 7 ? <>reacted <EmojiOrText value={emoji} /> to your note</> : kind === 1018 ? "voted in your poll" : "reposted your note"}
                    </span>
                  </div>
                </>
              )}
              <NotePreview ev={targetEv} profiles={profiles} />
            </div>
          );
        }

        const { ev } = entry;
        const actorPubkey = ev.kind === 9735 ? (zapperPubkeyFromKind9735(ev) ?? ev.pubkey) : ev.pubkey;

        let headline, detail;
        let preview = null;
        if (ev.kind === 9735) {
          const bolt11 = ev.tags?.find(t => t[0] === "bolt11")?.[1];
          const msats = parseBolt11Msats(bolt11);
          const comment = zapCommentFromKind9735(ev);
          const satsStr = fmtSats(msats);
          const satsLabel = msats === 1000 ? "sat" : "sats";
          const zappedEventId = ev.tags?.find(t => t[0] === "e")?.[1];
          const zappedEv = zappedEventId
            ? (evById.get(zappedEventId) ?? eventStore.getTimeline([{ ids: [zappedEventId] }])?.[0])
            : null;
          const zappedKind = zappedEv?.kind;
          if (zappedKind === 9041) {
            headline = `zapped your goal ${satsStr} ${satsLabel}`;
            detail = comment;
          } else if (zappedKind === 1068 || zappedKind === 6969) {
            let optionLabel = null;
            const descTag = ev.tags?.find(t => t[0] === "description");
            if (descTag) {
              try {
                const zapReq = JSON.parse(descTag[1]);
                const optId = zapReq.tags?.find(t => t[0] === "poll_option")?.[1];
                if (optId && zappedEv) {
                  optionLabel = zappedEv.tags?.find(t => t[0] === "poll_option" && t[1] === optId)?.[2] ?? null;
                }
              } catch {}
            }
            headline = `voted ${satsStr} ${satsLabel} in your zap poll`;
            detail = optionLabel ?? "";
          } else if (zappedEv) {
            headline = `zapped your note ${satsStr} ${satsLabel}`;
            detail = comment;
          } else {
            headline = `zapped you ${satsStr} ${satsLabel}`;
            detail = comment;
          }
          preview = zappedEv ? <NotePreview ev={zappedEv} profiles={profiles} /> : null;
        } else {
          if (ev.kind === 1 || ev.kind === 1111 || ev.kind === 1244) {
            // Kind-1 replies mark root via a lowercase "e" tag ("root" marker);
            // NIP-22 comments (1111/1244) mark it via the uppercase "E" tag.
            const rootId = ev.kind === 1
              ? ev.tags?.find(t => t[0] === "e" && t[3] === "root")?.[1]
              : ev.tags?.find(t => t[0] === "E")?.[1];
            const rootEv = rootId ? (evById.get(rootId) ?? eventStore.getTimeline([{ ids: [rootId] }])?.[0]) : null;
            if (rootEv?.kind === 6969) {
              headline = "Replied to your zap poll";
              detail = "";
            } else if (rootEv?.kind === 1068) {
              headline = "Replied to your poll";
              detail = "";
            } else {
              ({ headline, detail } = getNotificationSummary(ev));
            }
            preview = <NotePreview ev={ev} profiles={profiles} />;
          } else {
            ({ headline, detail } = getNotificationSummary(ev));
            if (ev.kind === 30023) {
              preview = <NotePreview ev={ev} profiles={profiles} />;
            }
          }
        }

        return (
          <div key={ev.id} className="notif-row" style={rowStyle}
            onClick={() => onOpenNotification?.(ev)} role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenNotification?.(ev); } }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
                <AvatarStack pubkeys={[actorPubkey]} profiles={profiles} onOpenProfile={onOpenProfile} />
              </div>
              <div className="notif-text" style={{ margin: 0 }}>
                <span className="notif-name-btn"
                  role="button" tabIndex={0}
                  onClick={e => { e.stopPropagation(); onOpenProfile?.(actorPubkey); }}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenProfile?.(actorPubkey); } }}>
                  {displayName(actorPubkey, profiles)}
                </span>
                <span className="notif-action"> {headline}{detail ? ` · ${detail}` : ""}</span>
              </div>
              <span style={timeStyle}>{relativeTime(ev.created_at)}</span>
            </div>
            {preview}
          </div>
        );
      })}
    </>
  );
}
