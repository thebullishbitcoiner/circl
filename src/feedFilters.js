// Single source of truth for home-feed filtering. Users toggle *groups* (a
// human-readable content type), not raw kinds; the group ids are what gets
// persisted and synced. New filter types (hide replies, time window, …) should
// be added as new keys on the same stored object rather than new plumbing —
// see useFeedFilterSettings.js.

export const FEED_KIND_GROUPS = [
  { id: "notes",      label: "Notes",           kinds: [1] },
  { id: "reposts",    label: "Reposts",         kinds: [6, 16] },
  { id: "highlights", label: "Highlights",      kinds: [9802] },
  { id: "articles",   label: "Articles",        kinds: [30023] },
  { id: "polls",      label: "Polls",           kinds: [1068, 6969] },
  { id: "calendar",   label: "Calendar Events", kinds: [31922, 31923] },
  { id: "streams",    label: "Live Streams",    kinds: [30311] },
  { id: "zapGoals",   label: "Zap Goals",       kinds: [9041] },
];

export const ALL_FEED_GROUP_IDS = FEED_KIND_GROUPS.map(g => g.id);

/** "Highlights (9802)" / "Reposts (6, 16)" */
export const groupDisplayLabel = g => `${g.label} (${g.kinds.join(", ")})`;

/** Re-order an arbitrary id list into registry order, dropping unknown ids. */
export const sortGroupIds = ids =>
  ALL_FEED_GROUP_IDS.filter(id => ids.includes(id));

/** Group id list → sorted unique numeric kinds. */
export const kindsForGroups = ids => {
  const set = new Set();
  for (const g of FEED_KIND_GROUPS) {
    if (ids.includes(g.id)) for (const k of g.kinds) set.add(k);
  }
  return [...set].sort((a, b) => a - b);
};
