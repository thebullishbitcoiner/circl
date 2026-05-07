import { useState, useEffect, useRef } from "react";
import { isHexPubkey, normPubkey, nip19 } from "../utils.js";

/** Coalesce rapid pubkey set growth (e.g. home feed) into one relay metadata pass. */
const PROFILE_METADATA_DEBOUNCE_MS = 120;

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

    let cancelled = false;
    const subsRef = { current: [] };
    const timer = setTimeout(() => {
      const list = pubkeysKey.split(",").filter(Boolean);
      const toFetch = list.filter(pk => !fetched.current.has(pk));
      if (!toFetch.length || cancelled) return;

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
            about: data.about ?? data.description ?? data.bio ?? prev[k]?.about ?? "",
            nip05: data.nip05 ?? prev[k]?.nip05 ?? null,
            lud16: data.lud16 ?? prev[k]?.lud16 ?? null,
            website: data.website ?? data.url ?? prev[k]?.website ?? null,
            banner: data.banner ?? data.cover ?? data.header ?? prev[k]?.banner ?? null,
          },
        }));
      };

      const sub = instance.subscribe(
        [{ kinds: [0], authors: toFetch }],
        { closeOnEose: true }
      );
      subsRef.current.push(sub);
      sub.on("event", e => {
        try {
          const meta = JSON.parse(e.content);
          const k = normalizeProfilePubkey(e.pubkey);
          upsertProfile(e.pubkey, meta);
          if (k) fetched.current.add(k);
        } catch {}
      });
    }, PROFILE_METADATA_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      for (const sub of subsRef.current) {
        try {
          sub?.stop?.();
        } catch {}
      }
      subsRef.current = [];
    };
  }, [ndk, pubkeysKey]);

  return { profiles };
}
