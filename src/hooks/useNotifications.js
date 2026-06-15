import { useState, useEffect, useRef } from "react";
import { isHexPubkey, normPubkey, parseBolt11Msats, isQuoteRepost, fmtSats, parseArticle } from "../utils.js";
import { pool, eventStore } from "../nostr.js";
import { RELAYS } from "../constants.js";
import useMailboxes from "./useMailboxes.js";

const NOTIF_KINDS = [1, 6, 7, 9735, 30023, 1018];
const SINCE_SEC = 60 * 60 * 24 * 7;

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
        setItems(prev => [...prev, raw].sort(compareDesc));
        setLoading(false);
      },
    });

    const eoseTimer = setTimeout(() => setLoading(false), 10000);

    return () => {
      clearTimeout(eoseTimer);
      sub.unsubscribe();
    };
  }, [pk, inboxes.join(",")]);

  return { items, loading };
}
