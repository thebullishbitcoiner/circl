// Lightweight, module-level tally of items the web-of-trust filter hid, so the
// settings screen can show "Filtered in the last hour: N". Deduped by event id.

const filtered = new Map(); // eventId -> timestamp (ms)
const WINDOW_MS = 60 * 60 * 1000;

export function recordFiltered(id) {
  if (!id || filtered.has(id)) return;
  filtered.set(id, Date.now());
}

function prune() {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [id, ts] of filtered) if (ts < cutoff) filtered.delete(id);
}

export function filteredLastHour() {
  prune();
  return filtered.size;
}

export function filteredSince() {
  prune();
  let min = Infinity;
  for (const ts of filtered.values()) min = Math.min(min, ts);
  return min === Infinity ? null : new Date(min);
}
