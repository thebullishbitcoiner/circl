import { useState, useEffect, useRef } from "react";
import { pool } from "../nostr.js";
import { RELAYS } from "../constants.js";
import { parseBolt11Msats } from "../utils.js";

// Warm-start cache: polls show last known counts instantly on remount while subscription reloads
const _pollCache = new Map(); // event.id → { voteCounts, myVote, voteEvents }

function parsePollOptions(event) {
  if (event.kind === 1068) {
    return event.tags
      .filter(t => t[0] === "option" && t[1] && t[2])
      .map(t => ({ id: t[1], label: t[2] }));
  }
  if (event.kind === 6969) {
    return event.tags
      .filter(t => t[0] === "poll_option" && t[1] && t[2])
      .map(t => ({ id: t[1], label: t[2] }));
  }
  return [];
}

function parseExpiry(event) {
  if (event.kind === 1068) {
    const tag = event.tags.find(t => t[0] === "endsAt");
    return tag ? Number(tag[1]) : null;
  }
  if (event.kind === 6969) {
    const tag = event.tags.find(t => t[0] === "closed_at");
    return tag ? Number(tag[1]) : null;
  }
  return null;
}

function parseZapLimits(event) {
  const min = event.tags.find(t => t[0] === "value_minimum")?.[1];
  const max = event.tags.find(t => t[0] === "value_maximum")?.[1];
  return { min: min ? Number(min) : null, max: max ? Number(max) : null };
}

function countStandardVotes(voteEvents, options, polltype) {
  // NIP-88: one vote per pubkey — largest created_at wins
  const latestByPubkey = new Map();
  for (const ev of voteEvents) {
    const existing = latestByPubkey.get(ev.pubkey);
    if (!existing || ev.created_at > existing.created_at) {
      latestByPubkey.set(ev.pubkey, ev);
    }
  }

  const counts = Object.fromEntries(options.map(o => [o.id, 0]));
  for (const ev of latestByPubkey.values()) {
    const responses = ev.tags.filter(t => t[0] === "response" && t[1]);
    if (polltype === "singlechoice") {
      const first = responses[0];
      if (first && counts[first[1]] !== undefined) counts[first[1]]++;
    } else {
      const seen = new Set();
      for (const r of responses) {
        if (!seen.has(r[1]) && counts[r[1]] !== undefined) {
          counts[r[1]]++;
          seen.add(r[1]);
        }
      }
    }
  }
  return counts;
}

function countZapVotes(zapReceipts, options, zapLimits) {
  const counts = Object.fromEntries(options.map(o => [o.id, 0]));
  for (const receipt of zapReceipts) {
    const descTag = receipt.tags.find(t => t[0] === "description");
    if (!descTag) continue;
    let zapReq;
    try { zapReq = JSON.parse(descTag[1]); } catch { continue; }

    const optionTag = (zapReq.tags || []).find(t => t[0] === "poll_option");
    if (!optionTag || counts[optionTag[1]] === undefined) continue;

    const bolt11Tag = receipt.tags.find(t => t[0] === "bolt11");
    if (!bolt11Tag) continue;
    const msats = parseBolt11Msats(bolt11Tag[1])
      || Number((zapReq.tags || []).find(t => t[0] === "amount")?.[1] || 0);
    const sats = Math.round(msats / 1000);

    if (zapLimits.min !== null && sats < zapLimits.min) continue;
    if (zapLimits.max !== null && sats > zapLimits.max) continue;

    counts[optionTag[1]] += sats;
  }
  return counts;
}

export default function usePollData({ event, myPubkey }) {
  const options = parsePollOptions(event);
  const expiry = parseExpiry(event);
  const polltype = event.tags.find(t => t[0] === "polltype")?.[1] ?? "singlechoice";
  const zapLimits = event.kind === 6969 ? parseZapLimits(event) : null;

  const [voteCounts, setVoteCounts] = useState(
    () => _pollCache.get(event.id)?.voteCounts ?? Object.fromEntries(options.map(o => [o.id, 0]))
  );
  const [myVote, setMyVote] = useState(() => _pollCache.get(event.id)?.myVote ?? null);
  const [loading, setLoading] = useState(() => !_pollCache.has(event.id));
  const [voteEvents, setVoteEvents] = useState(() => _pollCache.get(event.id)?.voteEvents ?? []);
  const rawEvents = useRef([]);

  const relayUrls = pool.relays.size > 0 ? [...pool.relays.keys()] : RELAYS;

  useEffect(() => {
    if (!options.length) { setLoading(false); return; }

    const cached = _pollCache.get(event.id);
    rawEvents.current = cached ? [...cached.voteEvents] : [];

    const filter = event.kind === 1068
      ? { kinds: [1018], "#e": [event.id] }
      : { kinds: [9735], "#e": [event.id] };

    const sub = pool.subscription(relayUrls, [filter]).subscribe({
      next: raw => {
        if (rawEvents.current.some(e => e.id === raw.id)) return;
        rawEvents.current = [...rawEvents.current, raw];
        setVoteEvents([...rawEvents.current]);

        let currentMyVote = null;
        let counts;
        if (event.kind === 1068) {
          counts = countStandardVotes(rawEvents.current, options, polltype);
          setVoteCounts(counts);
          const myEv = rawEvents.current
            .filter(e => e.pubkey === myPubkey)
            .sort((a, b) => b.created_at - a.created_at)[0];
          if (myEv) currentMyVote = myEv.tags.find(t => t[0] === "response")?.[1] ?? null;
          setMyVote(currentMyVote);
        } else {
          counts = countZapVotes(rawEvents.current, options, zapLimits);
          setVoteCounts(counts);
          for (const receipt of rawEvents.current) {
            const descTag = receipt.tags.find(t => t[0] === "description");
            if (!descTag) continue;
            try {
              const zapReq = JSON.parse(descTag[1]);
              if (zapReq.pubkey === myPubkey) {
                const optTag = (zapReq.tags || []).find(t => t[0] === "poll_option");
                if (optTag) { currentMyVote = optTag[1]; break; }
              }
            } catch {}
          }
          setMyVote(currentMyVote);
        }

        _pollCache.set(event.id, { voteCounts: counts, myVote: currentMyVote, voteEvents: [...rawEvents.current] });
        setLoading(false);
      },
    });

    const timeout = setTimeout(() => setLoading(false), 8000);
    return () => { clearTimeout(timeout); sub.unsubscribe(); };
  }, [event.id]);

  const total = Object.values(voteCounts).reduce((s, v) => s + v, 0);
  const isExpired = expiry ? Math.floor(Date.now() / 1000) > expiry : false;

  // Actual poll votes: standard polls deduplicate by pubkey (NIP-88); zap polls
  // filter to only receipts whose zap request carries a poll_option tag.
  const voterCount = event.kind === 1068
    ? new Set(voteEvents.map(e => e.pubkey)).size
    : voteEvents.filter(ev => {
        const desc = ev.tags.find(t => t[0] === "description");
        if (!desc) return false;
        try { return JSON.parse(desc[1]).tags?.some(t => t[0] === "poll_option") ?? false; } catch { return false; }
      }).length;

  return { options, voteCounts, myVote, total, isExpired, expiry, loading, polltype, zapLimits, voteEvents, voterCount };
}
