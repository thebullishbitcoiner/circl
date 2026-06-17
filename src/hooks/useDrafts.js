import { useState, useEffect, useCallback } from "react";
import { nostrSubscribe } from "../nostr.js";

export function draftId(replyTo, quotedEvent) {
  if (replyTo) return "reply-" + replyTo.id;
  if (quotedEvent) return "quote-" + quotedEvent.id;
  return "new-note";
}

export default function useDrafts({ pubkey, signAndPublish }) {
  const [drafts, setDrafts] = useState({});
  const [hasNip44, setHasNip44] = useState(false);

  useEffect(() => {
    setHasNip44(!!window.nostr?.nip44);
  }, []);

  useEffect(() => {
    if (!pubkey || !hasNip44) return;
    const sub = nostrSubscribe(
      [{ kinds: [31234], authors: [pubkey], "#k": ["1"] }],
      {
        onEvent: async ev => {
          const d = ev.tags?.find(t => t[0] === "d")?.[1];
          if (!d) return;
          if (!ev.content) {
            setDrafts(prev => { const next = { ...prev }; delete next[d]; return next; });
            return;
          }
          try {
            const plain = await window.nostr.nip44.decrypt(pubkey, ev.content);
            const state = JSON.parse(plain);
            setDrafts(prev => {
              if (prev[d]?._ts >= ev.created_at) return prev;
              return { ...prev, [d]: { ...state, _ts: ev.created_at } };
            });
          } catch {}
        },
      }
    );
    return () => sub.stop();
  }, [pubkey, hasNip44]);

  const saveDraft = useCallback(async (id, state) => {
    if (!pubkey || !hasNip44 || !signAndPublish) return;
    const payload = {
      content: state.content || "",
      media: state.media || [],
      emojiTags: state.emojiTags || [],
      excludedMentions: state.excludedMentions ? [...state.excludedMentions] : [],
      selectedCircleId: state.selectedCircleId ?? null,
    };
    let encrypted;
    try {
      encrypted = await window.nostr.nip44.encrypt(pubkey, JSON.stringify(payload));
    } catch { return; }
    const tags = [
      ["d", id],
      ["k", "1"],
      ["expiration", String(Math.floor(Date.now() / 1000) + 90 * 24 * 3600)],
    ];
    if (id.startsWith("reply-")) tags.push(["e", id.slice(6)]);
    else if (id.startsWith("quote-")) tags.push(["e", id.slice(6)]);
    try { await signAndPublish({ kind: 31234, content: encrypted, tags }); } catch {}
  }, [pubkey, hasNip44, signAndPublish]);

  const deleteDraft = useCallback(async (id) => {
    if (!pubkey || !signAndPublish) return;
    setDrafts(prev => { const next = { ...prev }; delete next[id]; return next; });
    try {
      await signAndPublish({ kind: 31234, content: "", tags: [["d", id], ["k", "1"]] });
    } catch {}
  }, [pubkey, signAndPublish]);

  const getDraft = useCallback((id) => drafts[id] ?? null, [drafts]);

  return { drafts, hasNip44, saveDraft, deleteDraft, getDraft };
}
