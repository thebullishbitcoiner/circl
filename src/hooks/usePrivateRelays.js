import useRelayList from "./useRelayList.js";

// Returns [{url: string, source: "public"|"encrypted"}] for the user's
// NIP-51 kind 10013 (private relays) list — used to store NIP-37 drafts.
export default function usePrivateRelays(pubkey) {
  return useRelayList(pubkey, 10013);
}
