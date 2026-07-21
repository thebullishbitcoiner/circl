import { useState, useRef } from "react";
import { displayName, nip19 } from "../utils.js";

function mediaFilesFromClipboard(clipboardData) {
  if (!clipboardData) return [];
  const files = Array.from(clipboardData.files || []).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
  if (files.length) return files;
  return Array.from(clipboardData.items || [])
    .filter(item => item.kind === "file" && (item.type.startsWith("image/") || item.type.startsWith("video/")))
    .map(item => item.getAsFile())
    .filter(Boolean);
}

// Shared logic for a contentEditable "rich text" note editor: mention-chip
// autocomplete/insertion, emoji insertion, plain-text paste, and drag/drop
// file forwarding. All DOM mutation is selection-based (works on whichever
// node currently has focus) except getContent(), which reads editorRef.
export default function useRichTextEditor({ profiles, myPubkey, onTextChange, onFilesDropped }) {
  const editorRef = useRef(null);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const getContent = () => {
    const div = editorRef.current;
    if (!div) return "";
    let result = "";
    const walk = node => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.dataset?.uri) {
          result += node.dataset.uri;
        } else if (node.tagName === "BR") {
          result += "\n";
        } else {
          if (node.tagName === "DIV" && result.length > 0) result += "\n";
          node.childNodes.forEach(walk);
        }
      }
    };
    div.childNodes.forEach(walk);
    return result;
  };

  const handleInput = () => {
    onTextChange?.(getContent());

    const sel = window.getSelection();
    if (!sel?.rangeCount) { setMentionResults([]); return; }
    const range = sel.getRangeAt(0);
    if (range.startContainer.nodeType !== Node.TEXT_NODE) { setMentionResults([]); return; }

    const textBefore = range.startContainer.textContent.slice(0, range.startOffset);
    const match = textBefore.match(/@([\w.-]*)$/);
    if (match && Object.keys(profiles || {}).length > 0) {
      const query = match[1].toLowerCase();
      setMentionIndex(0);
      const results = Object.entries(profiles)
        .filter(([pk, p]) => {
          if (pk === myPubkey) return false;
          const name = (p.display_name || p.name || "").toLowerCase();
          const nip05 = (p.nip05 || "").toLowerCase().split("@")[0];
          return !query || name.startsWith(query) || nip05.startsWith(query);
        })
        .slice(0, 6)
        .map(([pk]) => pk);
      setMentionResults(results);
    } else {
      setMentionResults([]);
    }
  };

  const selectMention = pk => {
    const div = editorRef.current;
    const name = displayName(pk, profiles);
    const uri  = `nostr:${nip19.npubEncode(pk)}`;

    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;

    const textBefore = textNode.textContent.slice(0, range.startOffset);
    const atIndex = textBefore.lastIndexOf("@");
    if (atIndex === -1) return;

    const replaceRange = document.createRange();
    replaceRange.setStart(textNode, atIndex);
    replaceRange.setEnd(textNode, range.startOffset);
    replaceRange.deleteContents();

    const chip = document.createElement("span");
    chip.className = "mention-chip";
    chip.dataset.uri = uri;
    chip.contentEditable = "false";
    chip.textContent = `@${name}`;
    replaceRange.insertNode(chip);

    const space = document.createTextNode(" ");
    chip.after(space);

    const newRange = document.createRange();
    newRange.setStart(space, space.length);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    setMentionResults([]);
    div?.focus();
    onTextChange?.(getContent());
  };

  // Handles only mention-list navigation; returns true if it consumed the keydown.
  const handleMentionKeyDown = e => {
    if (mentionResults.length === 0) return false;
    if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionResults.length - 1)); return true; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return true; }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); selectMention(mentionResults[mentionIndex]); return true; }
    if (e.key === "Escape") { setMentionResults([]); return true; }
    return false;
  };

  const handlePaste = e => {
    const files = mediaFilesFromClipboard(e.clipboardData);
    if (files.length) {
      e.preventDefault();
      onFilesDropped?.(files);
      return;
    }
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    const newRange = document.createRange();
    newRange.setStartAfter(node);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    onTextChange?.(getContent());
  };

  const handleDragOver = e => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = e => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = e => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (files.length) onFilesDropped?.(files);
  };

  // onEmojiTag is called with the custom-emoji tag (["emoji", shortcode, url]) when picking a custom emoji.
  const insertEmoji = (picked, onEmojiTag) => {
    const isCustom = picked && typeof picked === "object";
    const text     = isCustom ? picked.content : picked;
    const emojiTag = isCustom ? picked.emojiTag : null;
    const div = editorRef.current;
    if (!div) return;
    div.focus();
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      const newRange = document.createRange();
      newRange.setStartAfter(node);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    if (emojiTag) onEmojiTag?.(emojiTag);
    onTextChange?.(getContent());
  };

  return {
    editorRef,
    mentionResults,
    mentionIndex,
    setMentionIndex,
    isDragOver,
    getContent,
    handleInput,
    selectMention,
    handleMentionKeyDown,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    insertEmoji,
    clearMentions: () => setMentionResults([]),
  };
}
