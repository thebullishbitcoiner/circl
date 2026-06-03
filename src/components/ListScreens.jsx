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
  const sorted = [...zaps].sort((a, b) => b.amount - a.amount);
  const hasUniqTop = sorted.length === 1 || sorted[0].amount > sorted[1].amount;
  return (
    <ListScreen title="Zaps" subtitle={`${fmtSats(total)} sats total`} onBack={onBack}>
      {sorted.map((z, i) => (
        <div key={i} className="list-row" onClick={() => onOpenProfile?.(z.zapper)}>
          <div className={`list-row-av${hasUniqTop && i === 0 ? " top" : ""}`}>
            {avatarUrl(z.zapper, profiles)
              ? <img src={avatarUrl(z.zapper, profiles)} alt="" onError={e => { e.target.style.display = "none"; }} />
              : avatarInitial(z.zapper, profiles)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="list-row-name">
              {zapsRowLabel(z.zapper, profiles)}
              {hasUniqTop && i === 0 && <span className="list-badge">top zap</span>}
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

export function PollVotesScreen({ options, voteEvents, isZapPoll, profiles, onBack, onOpenProfile }) {
  const votesByOption = Object.fromEntries(options.map(o => [o.id, []]));

  for (const ev of voteEvents) {
    if (isZapPoll) {
      const descTag = ev.tags.find(t => t[0] === "description");
      if (!descTag) continue;
      try {
        const zapReq = JSON.parse(descTag[1]);
        const optTag = (zapReq.tags || []).find(t => t[0] === "poll_option");
        if (!optTag || !votesByOption[optTag[1]]) continue;
        const amtTag = (zapReq.tags || []).find(t => t[0] === "amount");
        const sats = amtTag ? Math.round(Number(amtTag[1]) / 1000) : 0;
        votesByOption[optTag[1]].push({ pubkey: zapReq.pubkey, sats });
      } catch {}
    } else {
      const optTag = ev.tags.find(t => t[0] === "response");
      if (!optTag || !votesByOption[optTag[1]]) continue;
      votesByOption[optTag[1]].push({ pubkey: ev.pubkey });
    }
  }

  const totalVotes = voteEvents.length;

  return (
    <ListScreen title="Votes" subtitle={`${totalVotes} vote${totalVotes !== 1 ? "s" : ""}`} onBack={onBack}>
      {options.map(opt => {
        const voters = votesByOption[opt.id] || [];
        if (!voters.length) return null;
        return (
          <div key={opt.id}>
            <div style={{ padding: "10px 16px 6px", fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".6px", borderBottom: "1px solid var(--border)" }}>
              {opt.label}
            </div>
            {voters.map((v, i) => (
              <div key={i} className="list-row" onClick={() => onOpenProfile?.(v.pubkey)}>
                <div className="list-row-av">
                  {avatarUrl(v.pubkey, profiles)
                    ? <img src={avatarUrl(v.pubkey, profiles)} alt="" onError={e => { e.target.style.display = "none"; }} />
                    : avatarInitial(v.pubkey, profiles)}
                </div>
                <div className="list-row-name">{displayName(v.pubkey, profiles)}</div>
                {isZapPoll && v.sats > 0 && <div className="list-row-right">{fmtSats(v.sats * 1000)}</div>}
              </div>
            ))}
          </div>
        );
      })}
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
                    tags={item.event.tags}
                    profiles={profiles}
                    onOpenProfile={onOpenProfile}
                    allEvents={allEvents}
                    onOpenThread={onOpenThread}
                    resolveEventById={resolveEventById}
                    className="note-text"
                    style={{ lineHeight: 1.55, color: "var(--text)", margin: "0 0 8px" }}
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
                        tags={item.quotedEvent.tags}
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
