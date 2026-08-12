import { decode } from "nostr-tools/nip19";

/** NIP-89-style `client` tag on all events published by this app */
export const NOSTR_CLIENT_TAG = ["client", "Circl"];

export const DEFAULT_RELAYS = [
  "wss://nos.lol",
  "wss://relay.primal.net",
];


export const ZAP_PRESETS = [
  { sats: 21,    label: "default" },
  { sats: 100,   label: "" },
  { sats: 500,   label: "" },
  { sats: 1000,  label: "1k" },
  { sats: 5000,  label: "5k" },
  { sats: 21000, label: "21k" },
];

export const GIPHY_KEY = "IOwWNUHzMmRh28umCJjJhKmaoOg71esr";

/** Lightning address + pubkey for "Zap the dev" CTA in Settings (NIP-57 zap) */
export const DEV_LUD16 = "bullish@rizful.com";
export const DEV_NPUB = "npub15ypxpg429uyjmp0zczuza902chuvvr4pn35wfzv8rx6cej4z8clq6jmpcx";
export const DEV_PUBKEY = decode(DEV_NPUB).data;

/** Inner Circl badge ring (NIP-58): shown on avatars issued a matching kind-8
 *  award by the platform account. Placeholder — replace once the platform
 *  Nostr account exists. */
export const PLATFORM_NPUB = "npub1...";
function safeDecodeNpub(npub) {
  try { return decode(npub).data; } catch { return null; }
}
export const PLATFORM_PUBKEY = safeDecodeNpub(PLATFORM_NPUB);
export const INNER_CIRCL_BADGE_D_TAG = "inner-circl";
export const INNER_CIRCL_BADGE_A_TAG = `30009:${PLATFORM_PUBKEY}:${INNER_CIRCL_BADGE_D_TAG}`;

/** Manually curated Inner Circl membership, until real kind-8 badge awards
 *  are flowing from the platform account above. Separate from NIP-05
 *  (.well-known/nostr.json), which is just identity resolution. */
export const INNER_CIRCL_MEMBER_PUBKEYS = [
  "a10260a2aa2f092d85e2c0b82e95eac5f8c60ea19c68e4898719b58ccaa23e3e", // thebullishbitcoiner
];
