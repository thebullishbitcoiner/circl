import { useState, useEffect, useRef } from "react";
import { isHexPubkey, normPubkey, nip19 } from "../utils.js";

/** Stable string for the set of hex pubkeys (sorted), so feed array churn does not restart subs. */
function pubkeysToKey(pubkeys) {
  const set = new Set();
  for (const pk of pubkeys || []) {
    const n = normPubkey(pk);
    if (isHexPubkey(n)) set.add(n);
  }
  return [...set].sort().join(",");
}

function normalizeProfilePubkey(pk) {
  const n = normPubkey(pk);
  if (isHexPubkey(n)) return n;
  if (typeof n === "string" && n.startsWith("npub1")) {
    try {
      const d = nip19.decode(n);
      if (d?.type === "npub" && isHexPubkey(d.data)) return normPubkey(d.data);
    } catch {}
  }
  return null;
}

export default function useProfiles({ ndk, pubkeys }) {
  const [profiles, setProfiles] = useState({});
  const fetched = useRef(new Set());

  const pubkeysKey = pubkeysToKey(pubkeys);

  useEffect(() => {
    const instance = ndk?.current;
    if (!instance || !pubkeysKey) return;

    const list = pubkeysKey.split(",").filter(Boolean);
    const toFetch = list.filter(pk => !fetched.current.has(pk));
    if (!toFetch.length) return;

    let cancelled = false;

    const upsertProfile = (pk, data = {}) => {
      const k = normalizeProfilePubkey(pk);
      if (!k) return;
      setProfiles(prev => ({
        ...prev,
        [k]: {
          name: data.display_name || data.preferred_name || data.name || prev[k]?.name || k.slice(0, 8),
          display_name: data.display_name || data.preferred_name || prev[k]?.display_name || null,
          preferred_name: data.preferred_name || prev[k]?.preferred_name || null,
          picture: data.picture ?? prev[k]?.picture ?? null,
          about: data.about ?? prev[k]?.about ?? "",
          nip05: data.nip05 ?? prev[k]?.nip05 ?? null,
          lud16: data.lud16 ?? prev[k]?.lud16 ?? null,
          banner: data.banner ?? prev[k]?.banner ?? null,
        },
      }));
    };

    // Fast path: batch profile metadata from Nostr Archives (cached server-side).
    fetch("https://api.nostrarchives.com/v1/profiles/metadata", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pubkeys: toFetch }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled) return;
        const rows = Array.isArray(data?.profiles) ? data.profiles : [];
        for (const row of rows) {
          upsertProfile(row.pubkey, row);
          const k = normalizeProfilePubkey(row.pubkey);
          if (k) fetched.current.add(k);
        }
      })
      .catch(() => {});

    const sub = instance.subscribe(
      [{ kinds: [0], authors: toFetch }],
      { closeOnEose: true }
    );

    sub.on("event", e => {
      try {
        const meta = JSON.parse(e.content);
        const k = normalizeProfilePubkey(e.pubkey);
        upsertProfile(e.pubkey, meta);
        if (k) fetched.current.add(k);
      } catch {}
    });

    return () => {
      cancelled = true;
      sub.stop();
    };
  }, [ndk, pubkeysKey]);

  return { profiles };
}
