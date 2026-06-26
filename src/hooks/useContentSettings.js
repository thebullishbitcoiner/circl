import { useState } from "react";

const KEY = "circl_content_settings";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

function save(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
}

export default function useContentSettings() {
  const [settings, setSettings] = useState(load);

  function update(patch) {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }

  return {
    autoplayVideos: settings.autoplayVideos ?? true,
    setAutoplayVideos: val => update({ autoplayVideos: val }),
    loopVideos: settings.loopVideos ?? true,
    setLoopVideos: val => update({ loopVideos: val }),
  };
}
