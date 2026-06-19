import { useState, useMemo, useEffect } from "react";
import Avatar from "./Avatar.jsx";
import NoteJsonModal from "./NoteJsonModal.jsx";
import { Bk, Rpi } from "./icons.jsx";
import { displayName, avatarUrl, avatarInitial, fmtSats, relativeTime, nip05OrNpub, normPubkey } from "../utils.js";
import { eventStore, pool } from "../nostr.js";
import { RELAYS } from "../constants.js";
import NoteContent from "./NoteContent.jsx";
import useProfiles from "../hooks/useProfiles.js";

function zapsRowLabel(pk, profiles) {
  const k = normPubkey(pk);
  if (profiles?.[k]?.display_name || profiles?.[k]?.name) {
    return displayName(pk, profiles);
  }
  return nip05OrNpub(pk, profiles);
}

function resolveCustomEmoji(emoji, tags) {
  const m = emoji?.match(/^:([a-zA-Z0-9_-]+):$/);
  if (!m) return null;
  return tags?.find(t => t[0] === "emoji" && t[1] === m[1])?.[2] ?? null;
}

function ThreeDot({ onClick }) {
  return (
    <button
      type="button"
      className="note-card-menu-btn"
      style={{ position: "static", flexShrink: 0 }}
      onClick={e => { e.stopPropagation(); onClick(); }}
      aria-label="View JSON"
    >
      <span /><span /><span />
    </button>
  );
}

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

export function ZapsScreen({ eventId, zaps, profiles: propProfiles, onBack, onOpenProfile }) {
  const [jsonEvent, setJsonEvent] = useState(null);
  const zapperPks = useMemo(() => [...new Set(zaps.map(z => z.zapper).filter(Boolean))], [zaps]);
  const { profiles: localProfiles } = useProfiles({ pubkeys: zapperPks });
  const profiles = useMemo(() => ({ ...propProfiles, ...localProfiles }), [propProfiles, localProfiles]);
  const total = zaps.reduce((s, z) => s + z.amount, 0);
  const sorted = [...zaps].sort((a, b) => b.amount - a.amount);
  const hasUniqTop = sorted.length === 1 || sorted[0].amount > sorted[1].amount;

  const openJson = z => {
    const ev = z.id ? eventStore.getTimeline([{ ids: [z.id] }])?.[0] : null;
    if (ev) setJsonEvent(ev);
  };

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
          {z.id && <ThreeDot onClick={() => openJson(z)} />}
        </div>
      ))}
      {jsonEvent && <NoteJsonModal event={jsonEvent} onClose={() => setJsonEvent(null)} />}
    </ListScreen>
  );
}

export function ReactionsScreen({ eventId, reactions: seedReactions, profiles: propProfiles, onBack, onOpenProfile }) {
  const [jsonEvent, setJsonEvent] = useState(null);
  const [items, setItems] = useState(() =>
    (seedReactions || []).map(r => typeof r === "string" ? { pk: r, emoji: "💜" } : r)
  );

  useEffect(() => {
    const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    const sub = pool.request(relayUrls, [{ kinds: [7], "#e": [eventId] }]).subscribe({
      next: raw => {
        if (!raw.content) return;
        eventStore.add(raw);
        const emoji = raw.content === "+" ? "💜" : raw.content;
        setItems(prev => {
          if (prev.some(r => r.id === raw.id)) return prev;
          return [...prev, { pk: raw.pubkey, emoji, tags: raw.tags, id: raw.id, created_at: raw.created_at }];
        });
      },
    });
    return () => sub.unsubscribe();
  }, [eventId]);

  const reactorPks = useMemo(() => [...new Set(items.map(r => r.pk).filter(Boolean))], [items]);
  const { profiles: localProfiles } = useProfiles({ pubkeys: reactorPks });
  const profiles = useMemo(() => ({ ...propProfiles, ...localProfiles }), [propProfiles, localProfiles]);

  const openJson = r => {
    const ev = r.id ? eventStore.getTimeline([{ ids: [r.id] }])?.[0] : null;
    if (ev) setJsonEvent(ev);
  };

  return (
    <ListScreen title="Reactions" subtitle={`${items.length} total`} onBack={onBack}>
      {items.map((r, i) => {
        const customUrl = resolveCustomEmoji(r.emoji, r.tags);
        return (
          <div key={i} className="list-row" onClick={() => onOpenProfile?.(r.pk)}>
            <div className="list-row-av">
              {avatarUrl(r.pk, profiles)
                ? <img src={avatarUrl(r.pk, profiles)} alt="" onError={e => { e.target.style.display = "none"; }} />
                : avatarInitial(r.pk, profiles)}
            </div>
            <div className="list-row-name">{displayName(r.pk, profiles)}</div>
            <div style={{ fontSize: 18, flexShrink: 0 }}>
              {customUrl
                ? <img src={customUrl} alt={r.emoji} className="note-custom-emoji" style={{ height: 22, verticalAlign: "middle" }} />
                : (r.emoji || "💜")}
            </div>
            {r.id && <ThreeDot onClick={() => openJson(r)} />}
          </div>
        );
      })}
      {jsonEvent && <NoteJsonModal event={jsonEvent} onClose={() => setJsonEvent(null)} />}
    </ListScreen>
  );
}

export function PollVotesScreen({ options, voteEvents, isZapPoll, profiles: propProfiles, onBack, onOpenProfile }) {
  const voterPks = useMemo(() => {
    const pks = new Set();
    for (const ev of voteEvents) {
      if (isZapPoll) {
        const descTag = ev.tags.find(t => t[0] === "description");
        if (!descTag) continue;
        try { const zapReq = JSON.parse(descTag[1]); if (zapReq.pubkey) pks.add(zapReq.pubkey); } catch {}
      } else {
        pks.add(ev.pubkey);
      }
    }
    return [...pks];
  }, [voteEvents, isZapPoll]);
  const { profiles: localProfiles } = useProfiles({ pubkeys: voterPks });
  const profiles = useMemo(() => ({ ...propProfiles, ...localProfiles }), [propProfiles, localProfiles]);
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

export function RepostsScreen({ eventId, reposts, profiles: propProfiles, onBack, onOpenProfile, onOpenThread, allEvents = [], resolveEventById }) {
  const [jsonEvent, setJsonEvent] = useState(null);
  const items = useMemo(() => reposts.map(r => typeof r === "string" ? { type: "repost", pubkey: r } : r), [reposts]);
  const reposterPks = useMemo(() => {
    const pks = new Set();
    for (const item of items) {
      if (item.pubkey) pks.add(item.pubkey);
      if (item.quotedEvent?.pubkey) pks.add(item.quotedEvent.pubkey);
    }
    return [...pks];
  }, [items]);
  const { profiles: localProfiles } = useProfiles({ pubkeys: reposterPks });
  const profiles = useMemo(() => ({ ...propProfiles, ...localProfiles }), [propProfiles, localProfiles]);

  const openJsonForRepost = item => {
    if (item.event) { setJsonEvent(item.event); return; }
    // Simple repost: find the kind:6 event in eventStore
    const ev = eventStore.getTimeline([{ kinds: [6], authors: [item.pubkey], "#e": [eventId] }])?.[0];
    if (ev) setJsonEvent(ev);
  };

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
                  <div style={{ marginLeft: "auto" }} onClick={e => e.stopPropagation()}>
                    <ThreeDot onClick={() => openJsonForRepost(item)} />
                  </div>
                </div>
                {item.event?.content && (
                  <NoteContent
                    content={item.event.content.replace(/\nnostr:(?:note1|nevent1|naddr1)\S*/gi, "").replace(/nostr:(?:note1|nevent1|naddr1)\S*/gi, "").trim()}
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
            <ThreeDot onClick={() => openJsonForRepost(item)} />
          </div>
        )
      )}
      {jsonEvent && <NoteJsonModal event={jsonEvent} onClose={() => setJsonEvent(null)} />}
    </ListScreen>
  );
}
