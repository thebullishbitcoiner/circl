import { decode } from "nostr-tools/nip19";

/** NIP-89-style `client` tag on all events published by this app */
export const NOSTR_CLIENT_TAG = ["client", "Circl"];

export const RELAYS = [
  "wss://relay.damus.io",
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
