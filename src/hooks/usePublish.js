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

  const publishHighlight = useCallback(async ({ text, context, sourceEvent, comment }) => {
    if (!text?.trim()) return null;
    const tags = [];
    if (sourceEvent) {
      if (sourceEvent.kind === 30023) {
        const d = sourceEvent.tags?.find(t => t[0] === "d")?.[1] ?? "";
        tags.push(["a", `30023:${sourceEvent.pubkey}:${d}`]);
      } else {
        tags.push(["e", sourceEvent.id]);
      }
      tags.push(["p", sourceEvent.pubkey]);
    }
    if (context?.trim()) tags.push(["context", context.trim()]);
    if (comment?.trim()) tags.push(["comment", comment.trim()]);
    try {
      return await signAndPublish({ kind: 9802, content: text.trim(), tags });
    } catch { return null; }
  }, [signAndPublish]);

  return { publish, publishEvent, publishHighlight };
}
