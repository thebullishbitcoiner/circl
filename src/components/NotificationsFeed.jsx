import Avatar from "./Avatar.jsx";
import { displayName, relativeTime, zapCommentFromKind9735, parseArticle } from "../utils.js";
import { getNotificationSummary } from "../hooks/useNotifications.js";

function snippetFor(ev) {
  if (ev.kind === 30023) {
    const { summary, title } = parseArticle(ev);
    const t = (summary || title || "").replace(/\s+/g, " ").trim();
    if (t) return t.length > 120 ? `${t.slice(0, 120)}…` : t;
  }
  if (ev.kind === 1 && typeof ev.content === "string") {
    const t = ev.content.replace(/\nnostr:\S+/g, "").replace(/nostr:\S+/g, "").trim();
    if (t) return t.length > 120 ? `${t.slice(0, 120)}…` : t;
  }
  if (ev.kind === 9735) {
    const c = zapCommentFromKind9735(ev);
    if (c) return c.length > 120 ? `${c.slice(0, 120)}…` : c;
  }
  return "";
}

export default function NotificationsFeed({
  items,
  profiles,
  onOpenProfile,
  onOpenNotification,
}) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">You&apos;re all caught up</div>
        <div className="empty-state-sub">
          Mentions, replies, reactions, zaps, and reposts of your notes from the last 30 days show up here
        </div>
      </div>
    );
  }

  return (
    <>
      {items.map((ev, i) => {
        const { headline, detail } = getNotificationSummary(ev);
        const name = displayName(ev.pubkey, profiles);
        const snip = snippetFor(ev);
        return (
          <div
            key={ev.id}
            className="notif-row"
            style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}
            onClick={() => onOpenNotification?.(ev)}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenNotification?.(ev);
              }
            }}
          >
            <div onClick={e => e.stopPropagation()}>
              <Avatar pk={ev.pubkey} profiles={profiles} size={40} />
            </div>
            <div className="notif-row-body">
              <div className="notif-row-title">
                <button
                  type="button"
                  className="notif-row-name-btn"
                  onClick={e => { e.stopPropagation(); onOpenProfile?.(ev.pubkey); }}
                >
                  {name}
                </button>
                <span className="notif-row-action">
                  {" "}
                  {headline}
                  {detail ? ` · ${detail}` : ""}
                </span>
              </div>
              <div className="notif-row-meta">{relativeTime(ev.created_at)}</div>
              {snip ? <div className="notif-row-snippet">{snip}</div> : null}
            </div>
          </div>
        );
      })}
    </>
  );
}
