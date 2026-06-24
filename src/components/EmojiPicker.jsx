import { useRef, useEffect } from "react";

function extractFirstEmoji(str) {
  if (!str) return null;
  try {
    const seg = new Intl.Segmenter([], { granularity: "grapheme" });
    for (const { segment } of seg.segment(str)) {
      if (/\p{Extended_Pictographic}/u.test(segment)) return segment;
    }
  } catch {
    const m = str.match(/\p{Extended_Pictographic}/u);
    if (m) return m[0];
  }
  return null;
}

export default function EmojiPicker({ onSelect, customEmojis = [] }) {
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const handleChange = (e) => {
    const emoji = extractFirstEmoji(e.target.value);
    if (emoji) onSelect(emoji);
  };

  return (
    <div className="ep-shell">
      <div className="ep-native-wrap">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          className="ep-native-input"
          placeholder="Tap an emoji on your keyboard…"
          onChange={handleChange}
        />
      </div>
      {customEmojis.length > 0 && (
        <div className="ep-grid-wrap">
          <div className="ep-cat-label">Custom</div>
          <div className="ep-grid">
            {customEmojis.map(({ name, url }) => (
              <button
                key={name}
                type="button"
                className="ep-btn"
                title={`:${name}:`}
                onClick={() => onSelect({ content: `:${name}:`, emojiTag: ["emoji", name, url] })}
              >
                <img src={url} alt={name} style={{ width: 22, height: 22, objectFit: "contain" }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
