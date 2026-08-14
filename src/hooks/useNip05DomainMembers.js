import { useEffect, useState } from "react";
import { parseNip05, fetchNip05Names, domainPubkeysFromNames, getCachedNip05Names } from "../utils/nip05.js";

/** Resolves a NIP-05 domain to the pubkeys registered in its .well-known/nostr.json. */
export function useNip05DomainMembers(domain) {
  // Seed synchronously from cache so a remount (e.g. opening a note and coming
  // back) shows the same content on its very first render instead of flashing
  // back to a loading state while a Promise microtask resolves.
  const [pubkeys, setPubkeys] = useState(() => {
    const cached = getCachedNip05Names(domain);
    return cached ? domainPubkeysFromNames(cached) : [];
  });
  const [loading, setLoading] = useState(() => !getCachedNip05Names(domain));

  useEffect(() => {
    if (!domain) { setPubkeys([]); setLoading(false); return; }
    let cancelled = false;
    if (!getCachedNip05Names(domain)) setLoading(true);
    fetchNip05Names(domain).then(names => {
      if (cancelled) return;
      setPubkeys(domainPubkeysFromNames(names));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [domain]);

  return { pubkeys, loading };
}

/** Verifies a profile's nip05 against its domain's nostr.json (names[name] === pubkey). */
export function useNip05Verified(nip05, pubkey) {
  const parsed = parseNip05(nip05);
  const [verified, setVerified] = useState(() => {
    const cached = parsed ? getCachedNip05Names(parsed.domain) : null;
    return cached ? cached[parsed.name] === pubkey : false;
  });
  const [loading, setLoading] = useState(() => !!parsed && !getCachedNip05Names(parsed.domain));

  useEffect(() => {
    if (!parsed || !pubkey) { setVerified(false); setLoading(false); return; }
    let cancelled = false;
    if (!getCachedNip05Names(parsed.domain)) setLoading(true);
    fetchNip05Names(parsed.domain).then(names => {
      if (cancelled) return;
      setVerified(names[parsed.name] === pubkey);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [parsed?.name, parsed?.domain, pubkey]);

  return { verified, name: parsed?.name, domain: parsed?.domain, loading };
}
