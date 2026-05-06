import { useState, useEffect, useRef } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";

export default function useInteractions({ ndk, myPubkey, otherPubkey, feedEvents }) {
  const [extras,  setExtras]  = useState([]);
  const [loading, setLoading] = useState(false);
  const seen = useRef(new Set());

  useEffect(() => {
    const instance = ndk?.current;
    const me  = normPubkey(myPubkey);
    const them = normPubkey(otherPubkey);
    if (!instance || !isHexPubkey(me) || !isHexPubkey(them)) return;

    setExtras([]);
    seen.current.clear();
    setLoading(true);
    feedEvents.forEach(e => seen.current.add(e.id));

    const sub = instance.subscribe(
      [
        { kinds: [1], authors: [them], "#p": [me],  limit: 100 },
        { kinds: [1], authors: [me],  "#p": [them], limit: 100 },
      ],
      { closeOnEose: true }
    );

    sub.on("event", e => {
      const raw = e.rawEvent();
      if (seen.current.has(raw.id)) return;
      seen.current.add(raw.id);
      setExtras(prev => [...prev, raw].sort((a, b) => a.created_at - b.created_at));
    });

    sub.on("eose", () => setLoading(false));

    return () => sub.stop();
  }, [ndk, myPubkey, otherPubkey]);

  return { extras, loading };
}
