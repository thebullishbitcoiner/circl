import { useState, useEffect, useRef } from "react";
import { isHexPubkey, normPubkey, nip19 } from "../utils.js";

/** Coalesce rapid pubkey set growth (e.g. home feed) into one Archives request + one relay sub. */
const PROFILE_METADATA_DEBOUNCE_MS = 120;
/** Max pubkeys per Nostr Archives POST (stay under typical body limits). */
const NOSTR_ARCHIVES_METADATA_BATCH = 96;

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
    const subRef = { current: null };
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
            about: data.about ?? prev[k]?.about ?? "",
            nip05: data.nip05 ?? prev[k]?.nip05 ?? null,
            lud16: data.lud16 ?? prev[k]?.lud16 ?? null,
            banner: data.banner ?? prev[k]?.banner ?? null,
          },
        }));
      };

      void (async () => {
        for (let i = 0; i < toFetch.length; i += NOSTR_ARCHIVES_METADATA_BATCH) {
          if (cancelled) return;
          const chunk = toFetch.slice(i, i + NOSTR_ARCHIVES_METADATA_BATCH);
          try {
            const r = await fetch("https://api.nostrarchives.com/v1/profiles/metadata", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ pubkeys: chunk }),
            });
            const data = r.ok ? await r.json() : null;
            if (cancelled || !data) continue;
            const rows = Array.isArray(data?.profiles) ? data.profiles : [];
            for (const row of rows) {
              upsertProfile(row.pubkey, row);
              const k = normalizeProfilePubkey(row.pubkey);
              if (k) fetched.current.add(k);
            }
          } catch {
            /* fall through to kind 0 */
          }
        }

        if (cancelled) return;
        subRef.current = instance.subscribe(
          [{ kinds: [0], authors: toFetch }],
          { closeOnEose: true }
        );

        subRef.current.on("event", e => {
          try {
            const meta = JSON.parse(e.content);
            const k = normalizeProfilePubkey(e.pubkey);
            upsertProfile(e.pubkey, meta);
            if (k) fetched.current.add(k);
          } catch {}
        });
      })();
    }, PROFILE_METADATA_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      try {
        subRef.current?.stop?.();
      } catch {}
      subRef.current = null;
    };
  }, [ndk, pubkeysKey]);

  return { profiles };
}
