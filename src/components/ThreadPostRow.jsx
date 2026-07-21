import { useState, useEffect } from "react";
import Avatar from "./Avatar.jsx";
import { avatarInitial } from "../utils.js";
import EmojiPicker from "./EmojiPicker.jsx";
import useRichTextEditor from "../hooks/useRichTextEditor.js";
import useGifPicker from "../hooks/useGifPicker.js";
import { uploadFile } from "../utils/upload.js";

const CHAR_LIMIT = 280;

export default function ThreadPostRow({
  post, index, canRemove, isPosted,
  onChange, onRemove,
  myPubkey, myProfile, profiles, customEmojis = [], blossomServers = [],
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);

  const setMedia = updater => onChange({ ...post, media: typeof updater === "function" ? updater(post.media) : updater });

  const uploadFiles = async files => {
    if (!files.length) return;
    setUploading(true); setUploadErr("");
    const errors = [];
    for (const file of files) {
      try {
        const url = await uploadFile(file, { blossomServers, myPubkey });
        setMedia(m => [...m, { url, type: file.type.startsWith("video/") ? "video" : "image" }]);
      } catch (err) {
        errors.push(err.message);
      }
    }
    if (errors.length) setUploadErr(`Upload failed — ${errors[0]}`);
    setUploading(false);
  };

  const richText = useRichTextEditor({
    profiles, myPubkey,
    onTextChange: content => onChange({ ...post, content }),
    onFilesDropped: uploadFiles,
  });
  const gifPicker = useGifPicker({ onPick: url => setMedia(m => [...m, { url, type: "gif" }]) });

  // contentEditable is uncontrolled — seed it from restored draft content once on mount.
  useEffect(() => {
    if (post.content && richText.editorRef.current) {
      richText.editorRef.current.textContent = post.content;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = e => { richText.handleMentionKeyDown(e); };

  const insertEmoji = picked => {
    richText.insertEmoji(picked, emojiTag => {
      onChange({
        ...post,
        emojiTags: post.emojiTags.some(t => t[1] === emojiTag[1]) ? post.emojiTags : [...post.emojiTags, emojiTag],
      });
    });
  };

  const handleFileChange = async e => {
    const files = Array.from(e.target.files || []);
    await uploadFiles(files);
    e.target.value = "";
  };

  const charCount = post.content.length;
  const fileInputId = `thread-file-${post.id}`;

  return (
    <div className="compose-thread-row">
      <div className="compose-thread-row-av">
        {myProfile?.picture
          ? <img src={myProfile.picture} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
          : avatarInitial(myPubkey, { [myPubkey]: myProfile })}
      </div>
      <div className="compose-thread-row-body">
        {isPosted ? (
          <div className="compose-thread-row-posted">
            <p>{post.content}</p>
            <span className="compose-thread-posted-badge">Posted ✓</span>
          </div>
        ) : (
          <>
            <div
              ref={richText.editorRef}
              className={`compose-sheet-input compose-richtext compose-thread-input${richText.isDragOver ? " drag-over" : ""}`}
              contentEditable
              suppressContentEditableWarning
              onInput={richText.handleInput}
              onKeyDown={handleKeyDown}
              onPaste={richText.handlePaste}
              onDragOver={richText.handleDragOver}
              onDragLeave={richText.handleDragLeave}
              onDrop={richText.handleDrop}
              data-placeholder={index === 0 ? "Start a thread…" : "Add another post…"}
            />

            {post.media.length > 0 && (
              <div className="compose-previews">
                {post.media.map((m, i) => (
                  <div key={i} className="compose-preview">
                    {m.type === "video"
                      ? <video src={m.url} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <img src={m.url} alt="" />}
                    <button className="compose-preview-remove" onClick={() => setMedia(ms => ms.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {uploadErr && <div className="compose-upload-status" style={{ color: "#E05C8A" }}>{uploadErr}</div>}
            {uploading && <div className="compose-upload-status">Uploading…</div>}

            {richText.mentionResults.length > 0 && (
              <div className="mention-list">
                {richText.mentionResults.map((pk, i) => (
                  <button
                    key={pk}
                    type="button"
                    className={`mention-item${i === richText.mentionIndex ? " active" : ""}`}
                    onMouseDown={e => { e.preventDefault(); richText.selectMention(pk); }}
                    onMouseEnter={() => richText.setMentionIndex(i)}
                  >
                    <Avatar pk={pk} profiles={profiles} size={28} />
                    <div className="mention-item-info">
                      <span className="mention-item-name">{profiles[pk]?.display_name || profiles[pk]?.name || pk.slice(0, 8)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showEmoji && (
              <EmojiPicker customEmojis={customEmojis} height={240} onSelect={emoji => { insertEmoji(emoji); setShowEmoji(false); }} />
            )}

            {gifPicker.showGif && (
              <div className="gif-picker">
                <div className="gif-search-row">
                  <input className="gif-search-input" placeholder="Search GIFs…" value={gifPicker.gifQuery} onChange={e => gifPicker.setGifQuery(e.target.value)} autoFocus />
                  <button type="button" className="compose-thread-btn" onClick={() => gifPicker.setShowGif(false)}>✕</button>
                </div>
                {gifPicker.gifLoading
                  ? <div style={{ padding: "20px", textAlign: "center", fontSize: 12, color: "var(--text-faint)" }}>Loading…</div>
                  : gifPicker.gifError
                    ? <div style={{ padding: "20px", textAlign: "center", fontSize: 12, color: "var(--text-faint)" }}>{gifPicker.gifError}</div>
                    : <div className="gif-grid">
                        {gifPicker.gifs.map((g, i) => {
                          const thumb = g.images?.fixed_height_small?.url || g.images?.fixed_height?.url;
                          return (
                            <div key={i} className="gif-item" onClick={() => gifPicker.pickGif(g)}>
                              {thumb && <img src={thumb} alt="" loading="lazy" />}
                            </div>
                          );
                        })}
                      </div>
                }
              </div>
            )}

            <div className="compose-thread-toolbar">
              <input id={fileInputId} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={handleFileChange} />
              <button type="button" className="compose-thread-btn" title="Add image or video" onClick={() => document.getElementById(fileInputId)?.click()}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
              <button
                type="button"
                className="compose-thread-btn"
                title="Emoji"
                onClick={() => { gifPicker.setShowGif(false); setShowEmoji(v => !v); }}
                style={showEmoji ? { color: "var(--primary)", background: "var(--surface)" } : {}}
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </button>
              <button
                type="button"
                className="compose-thread-btn"
                title="Add GIF"
                onClick={() => { setShowEmoji(false); gifPicker.setShowGif(v => !v); }}
                style={gifPicker.showGif ? { color: "var(--primary)", background: "var(--surface)" } : {}}
              >
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", letterSpacing: "-.5px" }}>GIF</span>
              </button>
              <span className={`compose-char-count${charCount > CHAR_LIMIT ? " warn" : ""}`}>{charCount}/{CHAR_LIMIT}</span>
              {canRemove && (
                <button type="button" className="compose-thread-btn compose-thread-remove" title="Remove post" onClick={onRemove}>✕</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
