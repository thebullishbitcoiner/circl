import { useState, useEffect } from "react";
import { isHexPubkey, normPubkey } from "../utils.js";

export default function useFollows({ ndk, pubkey }) {
  const [follows, setFollows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const instance = ndk?.current;
    if (!instance || !isHexPubkey(pubkey)) return;
    setLoading(true);

    let latest = { created_at: 0 };
    const sub = instance.subscribe(
      [{ kinds: [3], authors: [pubkey], limit: 1 }],
      { closeOnEose: true }
    );

    sub.on("event", e => {
      if (e.created_at <= latest.created_at) return;
      latest = e;
      const pks = e.tags
        .filter(t => t[0] === "p")
        .map(t => normPubkey(t[1]))
        .filter(isHexPubkey);
      if (pks.length) setFollows(pks);
    });

    sub.on("eose", () => setLoading(false));

    return () => sub.stop();
  }, [ndk, pubkey]);

  return { follows, loading };
}
