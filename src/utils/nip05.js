import { isHexPubkey } from "../utils.js";

const CACHE_TTL = 5 * 60 * 1000;

// Module-scope: domain -> { names, ts }. Shared by the feed and member-list
// pages so switching between them doesn't re-fetch the same nostr.json.
const namesCache = new Map();

/** Split a NIP-05 identifier into { name, domain }. Bare domains (no "@") are `_@domain`. */
export function parseNip05(nip05) {
  if (typeof nip05 !== "string" || !nip05) return null;
  const at = nip05.indexOf("@");
  const name = at === -1 ? "_" : nip05.slice(0, at);
  const domain = (at === -1 ? nip05 : nip05.slice(at + 1)).toLowerCase();
  if (!domain) return null;
  return { name: name || "_", domain };
}

/** Fetch (and cache) the full name -> pubkey map from a domain's .well-known/nostr.json. */
export function fetchNip05Names(domain) {
  const cached = namesCache.get(domain);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return Promise.resolve(cached.names);

  return fetch(`https://${domain}/.well-known/nostr.json`)
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      const raw = data?.names || {};
      const names = {};
      for (const [name, pk] of Object.entries(raw)) {
        if (isHexPubkey(pk)) names[name] = pk.toLowerCase();
      }
      namesCache.set(domain, { names, ts: Date.now() });
      return names;
    })
    .catch(() => {
      namesCache.set(domain, { names: {}, ts: Date.now() });
      return {};
    });
}

/** Deduped list of valid hex pubkeys from a name -> pubkey map. */
export function domainPubkeysFromNames(names) {
  return [...new Set(Object.values(names || {}))];
}
