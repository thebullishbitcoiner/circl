import { useState, useEffect } from "react";
import { parseBolt11Msats, zapperPubkeyFromKind9735, zapCommentFromKind9735 } from "../utils.js";
import { pool } from "../nostr.js";
import { RELAYS } from "../constants.js";

export default function useGoalProgress(goalEvent) {
  const [zaps, setZaps] = useState([]);

  useEffect(() => {
    if (!goalEvent?.id) return;

    const closedAt = goalEvent.tags?.find(t => t[0] === "closed_at")?.[1];
    const closedTs = closedAt ? Number(closedAt) : null;

    const goalRelays = goalEvent.tags
      ?.filter(t => t[0] === "relays")
      .flatMap(t => t.slice(1))
      .filter(Boolean);
    const relayUrls = goalRelays?.length
      ? goalRelays
      : pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;

    const seen = new Set();
    const sub = pool.subscription(relayUrls, [{ kinds: [9735], "#e": [goalEvent.id] }]).subscribe({
      next: raw => {
        if (seen.has(raw.id)) return;
        if (closedTs && raw.created_at > closedTs) return;
        seen.add(raw.id);
        const bolt11 = raw.tags.find(t => t[0] === "bolt11")?.[1];
        if (!bolt11) return;
        const msats = parseBolt11Msats(bolt11);
        if (!msats) return;
        const zapper  = zapperPubkeyFromKind9735(raw) ?? raw.pubkey;
        const comment = zapCommentFromKind9735(raw) ?? "";
        setZaps(prev => [...prev, { id: raw.id, zapper, amount: msats, comment, created_at: raw.created_at }]);
      },
    });

    return () => { sub.unsubscribe(); setZaps([]); };
  }, [goalEvent?.id]);

  const raisedMsats = zaps.reduce((s, z) => s + z.amount, 0);
  const targetMsats = Number(goalEvent?.tags?.find(t => t[0] === "amount")?.[1]) || 0;
  const percentage  = targetMsats > 0 ? Math.min(100, Math.round((raisedMsats / targetMsats) * 100)) : 0;
  const closedAt    = goalEvent?.tags?.find(t => t[0] === "closed_at")?.[1];
  const isClosed    = closedAt ? Math.floor(Date.now() / 1000) > Number(closedAt) : false;

  return { zaps, raisedMsats, targetMsats, percentage, zapCount: zaps.length, isClosed };
}
