import Avatar from "./Avatar.jsx";
import { Bk, Rpi } from "./icons.jsx";
import { displayName, avatarUrl, avatarInitial, fmtSats, relativeTime, nip05OrNpub, normPubkey } from "../utils.js";

function zapsRowLabel(pk, profiles) {
  const k = normPubkey(pk);
  if (profiles?.[k]?.display_name || profiles?.[k]?.name) {
    return displayName(pk, profiles);
  }
  return nip05OrNpub(pk, profiles);
}
import NoteContent from "./NoteContent.jsx";

function ListScreen({ title, subtitle, children, onBack }) {
  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <button className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <div>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{title}</span>
          {subtitle && <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: 8 }}>{subtitle}</span>}
        </div>
      </div>
      <div style={{ paddingBottom: 40 }}>{children}</div>
    </div>
  );
}

export function ZapsScreen({ eventId, zaps, profiles, onBack, onOpenProfile }) {
  const total = zaps.reduce((s, z) => s + z.amount, 0);
  return (
    <ListScreen title="Zaps" subtitle={`${fmtSats(total)} sats total`} onBack={onBack}>
      {zaps.map((z, i) => (
        <div key={i} className="list-row" onClick={() => onOpenProfile?.(z.zapper)}>
          <div className={`list-row-av${i === 0 ? " top" : ""}`}>
            {avatarUrl(z.zapper, profiles)
              ? <img src={avatarUrl(z.zapper, profiles)} alt="" onError={e => { e.target.style.display = "none"; }} />
              : avatarInitial(z.zapper, profiles)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="list-row-name">
              {zapsRowLabel(z.zapper, profiles)}
              {i === 0 && <span className="list-badge">top zap</span>}
            </div>
            {z.comment && <div className="list-row-meta">{z.comment}</div>}
          </div>
          <div className="list-row-right">{fmtSats(z.amount)}</div>
        </div>
      ))}
    </ListScreen>
  );
}

export function ReactionsScreen({ eventId, reactions, profiles, onBack, onOpenProfile }) {
  const items = reactions.map(r => typeof r === "string" ? { pk: r, emoji: "🧡" } : r);
  return (
    <ListScreen title="Reactions" subtitle={`${items.length} total`} onBack={onBack}>
      {items.map((r, i) => (
        <div key={i} className="list-row" onClick={() => onOpenProfile?.(r.pk)}>
          <div className="list-row-av">
            {avatarUrl(r.pk, profiles)
              ? <img src={avatarUrl(r.pk, profiles)} alt="" onError={e => { e.target.style.display = "none"; }} />
              : avatarInitial(r.pk, profiles)}
          </div>
          <div className="list-row-name">{displayName(r.pk, profiles)}</div>
          <div style={{ fontSize: 18 }}>{r.emoji || "🧡"}</div>
        </div>
      ))}
    </ListScreen>
  );
}

export function RepostsScreen({ eventId, reposts, profiles, onBack, onOpenProfile, onOpenThread, allEvents = [], resolveEventById }) {
  const items = reposts.map(r => typeof r === "string" ? { type: "repost", pubkey: r } : r);
  return (
    <ListScreen title="Reposts" subtitle={`${items.length} total`} onBack={onBack}>
      {items.map((item, i) =>
        item.type === "quote" ? (
          <div key={i} style={{ borderBottom: "1px solid var(--border)", padding: "12px 16px", cursor: "pointer" }}
            onClick={() => onOpenThread?.(item.event)}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flexShrink: 0 }}><Avatar pk={item.pubkey} profiles={profiles} size={34} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, fontFamily: "'DM Sans',sans-serif", color: "var(--text)", cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); onOpenProfile?.(item.pubkey); }}>
                    {displayName(item.pubkey, profiles)}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{relativeTime(item.event?.created_at)}</span>
                </div>
                {item.event?.content && (
                  <NoteContent
                    content={item.event.content.replace(/\nnostr:\S+/g, "").replace(/nostr:\S+/g, "").trim()}
                    profiles={profiles}
                    onOpenProfile={onOpenProfile}
                    allEvents={allEvents}
                    onOpenThread={onOpenThread}
                    resolveEventById={resolveEventById}
                    className="note-text"
                    style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text)", margin: "0 0 8px" }}
                  />
                )}
                {item.quotedEvent && (
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "var(--surface)", cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); onOpenThread?.(item.quotedEvent); }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <Avatar pk={item.quotedEvent.pubkey} profiles={profiles} size={16} />
                      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text)" }}>{displayName(item.quotedEvent.pubkey, profiles)}</span>
                    </div>
                    <div style={{ maxHeight: 140, overflow: "hidden" }}>
                      <NoteContent
                        content={item.quotedEvent.content}
                        profiles={profiles}
                        onOpenProfile={onOpenProfile}
                        allEvents={allEvents}
                        onOpenThread={onOpenThread}
                        resolveEventById={resolveEventById}
                        className="note-text"
                        style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div key={i} className="list-row" onClick={() => onOpenProfile?.(item.pubkey)}>
            <div className="list-row-av">
              {avatarUrl(item.pubkey, profiles)
                ? <img src={avatarUrl(item.pubkey, profiles)} alt="" onError={e => { e.target.style.display = "none"; }} />
                : avatarInitial(item.pubkey, profiles)}
            </div>
            <div className="list-row-name">{displayName(item.pubkey, profiles)}</div>
            <div style={{ color: "var(--text-faint)" }}><Rpi s={15} /></div>
          </div>
        )
      )}
    </ListScreen>
  );
}
