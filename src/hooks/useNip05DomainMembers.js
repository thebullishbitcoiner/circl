import { useEffect, useState } from "react";
import { parseNip05, fetchNip05Names, domainPubkeysFromNames } from "../utils/nip05.js";

/** Resolves a NIP-05 domain to the pubkeys registered in its .well-known/nostr.json. */
export function useNip05DomainMembers(domain) {
  const [pubkeys, setPubkeys] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!domain) { setPubkeys([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
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
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(!!parsed);

  useEffect(() => {
    if (!parsed || !pubkey) { setVerified(false); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchNip05Names(parsed.domain).then(names => {
      if (cancelled) return;
      setVerified(names[parsed.name] === pubkey);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [parsed?.name, parsed?.domain, pubkey]);

  return { verified, name: parsed?.name, domain: parsed?.domain, loading };
}
