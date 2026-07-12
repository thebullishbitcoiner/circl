import { useState, useEffect, useRef } from "react";
import { isHexPubkey, normPubkey, parseBolt11Msats, isQuoteRepost, fmtSats, parseArticle } from "../utils.js";
import { pool, eventStore, eventLoader } from "../nostr.js";
import { RELAYS } from "../constants.js";
import useMailboxes from "./useMailboxes.js";

const NOTIF_KINDS = [1, 6, 7, 9735, 30023, 1018];
const SINCE_SEC = 60 * 60 * 24 * 7;
// Reactions/reposts/poll-votes carry the *actor's* p-tags, which some clients
// (e.g. Amethyst) populate by copying every p-tag off the target note rather
// than just its author. Relying on "#p": [pk] alone therefore misfires for
// anyone merely mentioned in a note that later gets a reaction. Resolve the
// actual target event and only keep the notification if its author is pk.
const TARGET_KINDS = new Set([6, 7, 1018]);

// Resolves (and caches) the author pubkey of an event referenced by id,
// checking the local store before falling back to a relay fetch.
function resolveTargetAuthor(targetId, relayUrls, cache) {
  if (cache.has(targetId)) return cache.get(targetId);
  const promise = new Promise(resolve => {
    const stored = eventStore.getTimeline([{ ids: [targetId], limit: 1 }])?.[0];
    if (stored) { resolve(normPubkey(stored.pubkey)); return; }
    let done = false;
    const sub = eventLoader({ id: targetId, relays: relayUrls }).subscribe({
      next: ev => {
        if (done || !ev?.id) return;
        done = true;
        sub.unsubscribe();
        eventStore.add(ev);
        resolve(normPubkey(ev.pubkey));
      },
      error: () => { if (!done) { done = true; resolve(null); } },
      complete: () => { if (!done) { done = true; resolve(null); } },
    });
    setTimeout(() => { if (!done) { done = true; sub.unsubscribe(); resolve(null); } }, 8000);
  });
  cache.set(targetId, promise);
  return promise;
}

function compareDesc(a, b) {
  const ta = Number(a?.created_at) || 0;
  const tb = Number(b?.created_at) || 0;
  if (tb !== ta) return tb - ta;
  const ia = a?.id ?? "";
  const ib = b?.id ?? "";
  return ia < ib ? 1 : ia > ib ? -1 : 0;
}

export function getNotificationSummary(ev) {
  const kind = ev?.kind;
  if (kind === 7) {
    const emoji = ev.content === "+" ? "💜" : (ev.content || "·").trim() || "·";
    return { headline: `Reacted ${emoji} to your note`, detail: "", kind: "reaction" };
  }
  if (kind === 9735) {
    const bolt11 = ev.tags?.find(t => t[0] === "bolt11")?.[1];
    const msats  = parseBolt11Msats(bolt11);
    const amt    = fmtSats(msats);
    const unit   = msats === 1000 ? "sat" : "sats";
    return { headline: `zapped you ${amt} ${unit}`, detail: "", kind: "zap" };
  }
  if (kind === 1018) return { headline: "voted in your poll", detail: "", kind: "poll-vote" };
  if (kind === 6) return { headline: "Reposted your note", detail: "", kind: "repost" };
  if (kind === 30023) {
    const t = parseArticle(ev).title;
    return { headline: "Mentioned you in an article", detail: t && t !== "Untitled" ? t : "", kind: "article" };
  }
  if (kind === 1) {
    if (isQuoteRepost(ev)) return { headline: "Mentioned you in a quote", detail: "", kind: "quote" };
    const inThread = ev.tags?.some(t => t[0] === "e" && t[3] !== "mention");
    if (inThread) return { headline: "Replied in a thread you're in", detail: "", kind: "reply" };
    return { headline: "Mentioned you", detail: "", kind: "mention" };
  }
  return { headline: "Activity", detail: "", kind: "other" };
}

export default function useNotifications({ pubkey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const seen = useRef(new Set());
  const targetAuthorCache = useRef(new Map());
  const cancelled = useRef(false);

  const pk = normPubkey(pubkey);
  const { inboxes } = useMailboxes(isHexPubkey(pk) ? pk : null);

  useEffect(() => {
    if (!isHexPubkey(pk)) {
      setItems([]);
      setLoading(false);
      return;
    }

    setItems([]);
    seen.current = new Set();
    targetAuthorCache.current = new Map();
    cancelled.current = false;
    setLoading(true);

    // Use own read (inbox) relays if known, fall back to connected pool relays
    const relayUrls = inboxes.length > 0 ? inboxes
      : pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;
    const since = Math.floor(Date.now() / 1000) - SINCE_SEC;

    const sub = pool.subscription(relayUrls, [{ kinds: NOTIF_KINDS, "#p": [pk], limit: 500, since }]).subscribe({
      next: raw => {
        eventStore.add(raw);
        if (normPubkey(raw.pubkey) === pk) return;
        if (seen.current.has(raw.id)) return;
        seen.current.add(raw.id);

        if (TARGET_KINDS.has(raw.kind)) {
          // These carry the current user's pubkey in a "p" tag, but some
          // clients copy *all* of the target note's p-tags into the
          // reaction/repost/vote rather than just its author's — so being
          // p-tagged here doesn't mean the target note is actually ours.
          // Confirm authorship before surfacing it as "your note".
          const eTags = raw.tags?.filter(t => t[0] === "e") ?? [];
          const targetId = eTags[eTags.length - 1]?.[1];
          if (!targetId) return;
          resolveTargetAuthor(targetId, relayUrls, targetAuthorCache.current).then(authorPk => {
            if (cancelled.current || authorPk !== pk) return;
            setItems(prev => (prev.some(e => e.id === raw.id) ? prev : [...prev, raw].sort(compareDesc)));
          });
          setLoading(false);
          return;
        }

        setItems(prev => [...prev, raw].sort(compareDesc));
        setLoading(false);
      },
    });

    const eoseTimer = setTimeout(() => setLoading(false), 10000);

    return () => {
      cancelled.current = true;
      clearTimeout(eoseTimer);
      sub.unsubscribe();
    };
  }, [pk, inboxes.join(",")]);

  return { items, loading };
}
