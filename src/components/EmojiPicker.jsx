import { useEffect, useState } from "react";
import Picker from "@emoji-mart/react";

export default function EmojiPicker({ onSelect, customEmojis = [], height }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    import("@emoji-mart/data").then(m => setData(m.default));
  }, []);

  if (!data) return <div className="ep-loading" />;

  const custom = customEmojis.length > 0 ? [{
    id: "nostr",
    name: "Custom",
    emojis: customEmojis.map(({ name, url }) => ({
      id: name,
      name,
      skins: [{ src: url }],
    })),
  }] : [];

  const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";

  return (
    <div onClick={e => e.stopPropagation()}>
      <Picker
        data={data}
        custom={custom}
        theme={theme}
        onEmojiSelect={emoji => {
          if (emoji.src) {
            onSelect({ content: `:${emoji.id}:`, emojiTag: ["emoji", emoji.id, emoji.src] });
          } else {
            onSelect(emoji.native);
          }
        }}
        skinTonePosition="search"
        previewPosition="none"
        navPosition="bottom"
        set="native"
        width="100%"
        height={height ?? 380}
      />
    </div>
  );
}
