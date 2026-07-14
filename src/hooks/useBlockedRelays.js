import { useEffect } from "react";
import useRelayList from "./useRelayList.js";
import { setBlockedRelayUrls } from "../nostr.js";

// Returns [{url: string, source: "public"|"encrypted"}] for the user's
// NIP-51 kind 10006 (blocked relays) list, and keeps the shared relay pool's
// block set in sync so blocked relays are never connected to.
export default function useBlockedRelays(pubkey) {
  const relays = useRelayList(pubkey, 10006);

  useEffect(() => {
    setBlockedRelayUrls(relays.map(r => r.url));
  }, [relays]);

  return relays;
}
