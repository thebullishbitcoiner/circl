import { useState, useRef } from "react";
import Avatar from "./Avatar.jsx";
import { displayName, shortNpub } from "../utils.js";

const TABS = [
  { id: "users",    label: "Users" },
  { id: "hashtags", label: "Hashtags" },
  { id: "words",    label: "Words" },
  { id: "threads",  label: "Threads" },
];

export default function MutedPage({
  mutes = [], hashtags = [], words = [], threads = [],
  profiles,
  onUnmute, onMuteHashtag, onUnmuteHashtag, onMuteWord, onUnmuteWord, onUnmuteThread,
  onOpenProfile,
}) {
  const [tab, setTab] = useState("users");
  const [hashtagInput, setHashtagInput] = useState("");
  const [wordInput, setWordInput] = useState("");
  const hashtagInputRef = useRef(null);
  const wordInputRef = useRef(null);

  const submitHashtag = () => {
    const val = hashtagInput.trim().replace(/^#/, "");
    if (!val) return;
    onMuteHashtag?.(val);
    setHashtagInput("");
    hashtagInputRef.current?.focus();
  };

  const submitWord = () => {
    const val = wordInput.trim();
    if (!val) return;
    onMuteWord?.(val);
    setWordInput("");
    wordInputRef.current?.focus();
  };

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <span className="feed-title">Muted</span>
      </div>

      {/* Tab bar */}
      <div className="profile-stats" style={{ borderBottom: "1px solid var(--border)" }}>
        {TABS.map(t => (
          <div
            key={t.id}
            className={`profile-stat ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <div className="profile-stat-label">{t.label}</div>
          </div>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        mutes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No muted users</div>
            <div className="empty-state-sub">Users you mute will appear here</div>
          </div>
        ) : (
          <div>
            {mutes.map(pk => {
              const name = displayName(pk, profiles);
              return (
                <div key={pk} className="list-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
                  <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => onOpenProfile?.(pk)}>
                    <Avatar pk={pk} profiles={profiles} size={40} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onOpenProfile?.(pk)}>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{shortNpub(pk)}</div>
                  </div>
                  <button type="button" className="profile-follow-btn" style={{ flexShrink: 0 }} onClick={() => onUnmute?.(pk)}>
                    Unmute
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Hashtags tab */}
      {tab === "hashtags" && (
        <div>
          <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
            <input
              ref={hashtagInputRef}
              type="text"
              value={hashtagInput}
              onChange={e => setHashtagInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitHashtag()}
              placeholder="Add a hashtag…"
              style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", color: "var(--text)", outline: "none" }}
            />
            <button type="button" className="profile-follow-btn" onClick={submitHashtag}>Mute</button>
          </div>
          {hashtags.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No muted hashtags</div>
              <div className="empty-state-sub">Hashtags you mute will appear here</div>
            </div>
          ) : (
            hashtags.map(tag => (
              <div key={tag} className="list-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", fontWeight: 600, color: "var(--primary)" }}>#{tag}</span>
                </div>
                <button type="button" className="profile-follow-btn" style={{ flexShrink: 0 }} onClick={() => onUnmuteHashtag?.(tag)}>
                  Unmute
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Words tab */}
      {tab === "words" && (
        <div>
          <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
            <input
              ref={wordInputRef}
              type="text"
              value={wordInput}
              onChange={e => setWordInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitWord()}
              placeholder="Add a word or phrase…"
              style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", color: "var(--text)", outline: "none" }}
            />
            <button type="button" className="profile-follow-btn" onClick={submitWord}>Mute</button>
          </div>
          {words.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No muted words</div>
              <div className="empty-state-sub">Words you mute will appear here</div>
            </div>
          ) : (
            words.map(word => (
              <div key={word} className="list-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "var(--font-base)", fontWeight: 500, color: "var(--text)" }}>{word}</span>
                </div>
                <button type="button" className="profile-follow-btn" style={{ flexShrink: 0 }} onClick={() => onUnmuteWord?.(word)}>
                  Unmute
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Threads tab */}
      {tab === "threads" && (
        threads.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No muted threads</div>
            <div className="empty-state-sub">Threads you mute will appear here</div>
          </div>
        ) : (
          <div>
            {threads.map(id => (
              <div key={id} className="list-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)", wordBreak: "break-all" }}>{id}</span>
                </div>
                <button type="button" className="profile-follow-btn" style={{ flexShrink: 0 }} onClick={() => onUnmuteThread?.(id)}>
                  Unmute
                </button>
              </div>
            ))}
          </div>
        )
      )}

    </div>
  );
}
