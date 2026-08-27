import { useMemo, useState } from "react";
import { ALL_FEED_GROUP_IDS, kindsForGroups, sortGroupIds } from "../feedFilters.js";

const KEY = "circl_feed_filters";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

function save(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
}

/**
 * Local-only, but mirrored across devices by useAppSettingsSync.js. The stored
 * value is a generic object so future feed filters slot in as extra keys.
 */
export default function useFeedFilterSettings() {
  const [settings, setSettings] = useState(load);

  function update(patch) {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }

  const kindGroups = useMemo(
    () => sortGroupIds(Array.isArray(settings.kindGroups) ? settings.kindGroups : ALL_FEED_GROUP_IDS),
    [settings.kindGroups]
  );

  const feedKinds = useMemo(() => kindsForGroups(kindGroups), [kindGroups]);

  return {
    kindGroups,
    setKindGroups: ids => update({ kindGroups: sortGroupIds(ids) }),
    feedKinds,
  };
}
