# Circl

A follows-only Nostr client. Your circle. Your signal.

## Setup

### Prerequisites

- Node.js 18+
- A NIP-07 browser extension:
  - **Chrome/Brave**: [Alby](https://getalby.com) or [nos2x](https://github.com/fiatjaf/nos2x)
  - **Firefox**: [nos2x-fox](https://addons.mozilla.org/en-US/firefox/addon/nos2x-fox/)
  - **Mobile**: [Amber](https://github.com/greenart7c3/Amber) (Android, NIP-55)

### Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and click "Connect with Nostr extension".

### Build for production

```bash
npm run build
npm run preview
```

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

## Stack

- **React 18** + **Vite**
- **nostr-tools** — relay pool, NIP-07 signing, NIP-19 encoding
- **NIP-07** — browser extension key management (private key never touches the app)
- **Rizful** — Lightning wallet connect (NWC) for real zaps

## Relays

Default relays in `src/App.jsx`:

```js
const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://nostr.wine",
];
```

## Notes

- The `useFeed` hook fetches the last 48h of notes from your follow list.
  Increase `since` for more history (at the cost of load time).
- Reactions (kind 7) and zap receipts (kind 9735) from follows are fetched
  alongside the main feed and populate the shared state maps automatically.
