import { useState, useCallback } from "react";

export default function useBookmarks() {
  const [bm, setBm] = useState(new Set());

  const toggle = useCallback(id => {
    setBm(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const isBookmarked = useCallback(id => bm.has(id), [bm]);

  return { bookmarked: bm, toggle, isBookmarked };
}
