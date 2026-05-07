import { useState, useEffect, useRef } from "react";
import { isHexPubkey, normPubkey, parseBolt11Msats, isQuoteRepost, fmtSats, parseArticle } from "../utils.js";

const NOTIF_KINDS = [1, 6, 7, 9735, 30023];
const SINCE_SEC = 60 * 60 * 24 * 30;

function compareDesc(a, b) {
  const ta = Number(a?.created_at) || 0;
  const tb = Number(b?.created_at) || 0;
  if (tb !== ta) return tb - ta;
  const ia = a?.id ?? "";
  const ib = b?.id ?? "";
  return ia < ib ? 1 : ia > ib ? -1 : 0;
}

/** User-facing summary for a notification event (kinds 1, 6, 7, 9735 with #p). */
export function getNotificationSummary(ev) {
  const kind = ev?.kind;
  if (kind === 7) {
    const emoji = ev.content === "+" ? "🧡" : (ev.content || "·").trim() || "·";
    return { headline: `Reacted ${emoji} to your note`, detail: "", kind: "reaction" };
  }
  if (kind === 9735) {
    const bolt11 = ev.tags?.find(t => t[0] === "bolt11")?.[1];
    const msats = parseBolt11Msats(bolt11);
    const amt = fmtSats(msats);
    return { headline: `Zapped you ${amt}`, detail: "", kind: "zap" };
  }
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

/**
 * Subscribes to notes, reposts, reactions, and zaps that tag the user in `p`
 * (mentions, replies, reactions to your notes, zaps, reposts).
 */
export default function useNotifications({ ndk, pubkey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const seen = useRef(new Set());

  useEffect(() => {
    const instance = ndk?.current;
    const pk = normPubkey(pubkey);
    if (!instance || !isHexPubkey(pk)) {
      setItems([]);
      return;
    }

    setItems([]);
    seen.current = new Set();
    setLoading(true);

    const since = Math.floor(Date.now() / 1000) - SINCE_SEC;
    const sub = instance.subscribe(
      [{ kinds: NOTIF_KINDS, "#p": [pk], limit: 500, since }],
      {}
    );

    sub.on("event", e => {
      const raw = e.rawEvent();
      if (normPubkey(raw.pubkey) === pk) return;
      if (seen.current.has(raw.id)) return;
      seen.current.add(raw.id);
      setItems(prev => sortMerge(prev, raw));
      setLoading(false);
    });

    sub.on("eose", () => setLoading(false));

    return () => {
      try {
        sub.stop();
      } catch {}
    };
  }, [ndk, pubkey]);
  return { items, loading };
}

function sortMerge(prev, raw) {
  return [...prev, raw].sort(compareDesc);
}
