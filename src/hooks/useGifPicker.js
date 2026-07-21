import { useState, useEffect } from "react";
import { GIPHY_KEY } from "../constants.js";

// Shared GIPHY search/trending state + fetch/debounce logic for a GIF picker popover.
export default function useGifPicker({ onPick }) {
  const [showGif,    setShowGif]    = useState(false);
  const [gifQuery,   setGifQuery]   = useState("");
  const [gifs,       setGifs]       = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError,   setGifError]   = useState("");

  const fetchGifs = async url => {
    setGifLoading(true);
    setGifError("");
    try {
      const res  = await fetch(url);
      const json = await res.json();
      if (json.message) { setGifError(json.message); setGifs([]); }
      else setGifs(json.data || []);
    } catch {
      setGifError("Could not load GIFs");
      setGifs([]);
    }
    setGifLoading(false);
  };

  useEffect(() => {
    if (!gifQuery.trim()) { setGifs([]); setGifError(""); return; }
    const t = setTimeout(() =>
      fetchGifs(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(gifQuery)}&limit=18&rating=g`),
      400
    );
    return () => clearTimeout(t);
  }, [gifQuery]);

  useEffect(() => {
    if (!showGif || gifQuery) return;
    fetchGifs(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=18&rating=g`);
  }, [showGif]);

  const pickGif = gif => {
    const url = gif.images?.original?.url || gif.images?.downsized?.url;
    if (!url) return;
    onPick?.(url);
    setShowGif(false); setGifQuery("");
  };

  return { showGif, setShowGif, gifQuery, setGifQuery, gifs, gifLoading, gifError, pickGif };
}
