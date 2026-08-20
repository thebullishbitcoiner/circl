import { useCallback } from "react";
import { addNostrUriPrefixes } from "../utils.js";

const isNoteLikeKind = kind => kind === 1 || kind === 1111;

export default function usePublish({ signAndPublish, pubkey }) {
  const publish = useCallback(async content => {
    if (!content.trim()) return null;
    try {
      return await signAndPublish({ kind: 1, content: addNostrUriPrefixes(content.trim()), tags: [] });
    } catch { return null; }
  }, [signAndPublish]);

  const publishEvent = useCallback(async (tmpl, opts) => {
    try {
      const event = isNoteLikeKind(tmpl?.kind) && typeof tmpl.content === "string"
        ? { ...tmpl, content: addNostrUriPrefixes(tmpl.content) }
        : tmpl;
      return await signAndPublish(event, opts);
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
    } catch (e) {
      console.error("[highlight] publish failed:", e);
      return null;
    }
  }, [signAndPublish]);

  return { publish, publishEvent, publishHighlight };
}
