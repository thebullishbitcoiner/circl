import { useCallback } from "react";

export default function usePublish({ signAndPublish, pubkey }) {
  const publish = useCallback(async content => {
    if (!content.trim()) return null;
    try {
      return await signAndPublish({ kind: 1, content: content.trim(), tags: [] });
    } catch { return null; }
  }, [signAndPublish]);

  const publishEvent = useCallback(async tmpl => {
    try {
      return await signAndPublish(tmpl);
    } catch { return null; }
  }, [signAndPublish]);

  return { publish, publishEvent };
}
