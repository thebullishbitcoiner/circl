import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import NoteContent from "./NoteContent.jsx";
import { nip19, displayName } from "../utils.js";

function toPlainText(children) {
  if (!children) return "";
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(toPlainText).join("");
  if (typeof children === "object" && children.props?.children != null) {
    return toPlainText(children.props.children);
  }
  return "";
}

function preprocessNostrNpubs(content, profiles) {
  if (!content || (!/nostr:npub1/i.test(content) && !/nostr:nprofile1/i.test(content))) return content;
  return content.replace(/nostr:(npub1|nprofile1)[023456789acdefghjklmnpqrstuvwxyz]+/gi, match => {
    try {
      const d = nip19.decode(match.slice(6));
      let pk = null;
      if (d?.type === "npub") pk = d.data;
      else if (d?.type === "nprofile") pk = d.data?.pubkey;
      if (pk) return `[@${displayName(pk, profiles)}](${match})`;
    } catch {}
    return match;
  });
}

function preprocessBullets(content) {
  if (!content) return content;
  const lines = content.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = /^\s*•/.test(line);
    const prevLine = i > 0 ? lines[i - 1] : null;
    const prevIsBullet = prevLine !== null && /^\s*•/.test(prevLine);
    if (isBullet && !prevIsBullet && prevLine !== null && prevLine !== '') {
      out.push('');
    }
    out.push(isBullet ? line.replace(/^\s*•\s*/, '- ') : line);
  }
  return out.join('\n');
}

export default function ArticleBody({
  content,
  profiles,
  onOpenProfile,
  allEvents = [],
  onOpenThread,
  resolveEventById,
}) {
  let firstParagraphDone = false;
  return (
    <div className="reader-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={url => /^nostr:/i.test(url) ? url : defaultUrlTransform(url)}
        components={{
          p: ({ children }) => {
            const txt = toPlainText(children).trim();
            const isStandaloneNevent = /^nostr:nevent1[023456789acdefghjklmnpqrstuvwxyz]+$/i.test(txt);
            if (isStandaloneNevent) {
              return (
                <NoteContent
                  content={txt}
                  profiles={profiles}
                  onOpenProfile={onOpenProfile}
                  allEvents={allEvents}
                  onOpenThread={onOpenThread}
                  resolveEventById={resolveEventById}
                  className="note-text"
                />
              );
            }
            const isMediaOnlyParagraph = /^!\[[^\]]*\]\(https?:\/\/[^)\s]+\)$/i.test(txt);
            const shouldDropCap = !firstParagraphDone && !isMediaOnlyParagraph && txt.length > 0;
            const cls = shouldDropCap ? "drop-cap" : "";
            if (shouldDropCap) firstParagraphDone = true;
            return <p className={cls}>{children}</p>;
          },
          a: ({ href, children }) => {
            if (href && /^nostr:(npub1|nprofile1)/i.test(href)) {
              return (
                <span className="ix-mention" style={{ cursor: "pointer", textDecoration: "none" }} onClick={e => {
                  e.stopPropagation();
                  try {
                    const d = nip19.decode(href.slice(6));
                    let pk = null;
                    if (d?.type === "npub") pk = d.data;
                    else if (d?.type === "nprofile") pk = d.data?.pubkey;
                    if (pk) onOpenProfile?.(pk);
                  } catch {}
                }}>
                  {children}
                </span>
              );
            }
            return <a href={href || "#"} target="_blank" rel="noopener noreferrer">{children}</a>;
          },
          img: ({ src, alt }) => (
            <span className="reader-media-wrap">
              <img className="reader-media-img" src={src || ""} alt={alt || ""} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            </span>
          ),
          hr: () => <div className="section-div">· · ·</div>,
        }}
      >
        {preprocessBullets(preprocessNostrNpubs(content, profiles)) || ""}
      </ReactMarkdown>
    </div>
  );
}
