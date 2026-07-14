import useRelayList from "./useRelayList.js";

// Returns [{url: string, source: "public"|"encrypted"}] for the user's
// NIP-51 kind 10007 (search relays) list.
export default function useSearchRelays(pubkey) {
  return useRelayList(pubkey, 10007);
}
