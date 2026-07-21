import ThreadPostRow from "./ThreadPostRow.jsx";

let _threadRowId = 0;
export const makeThreadPost = () => ({ id: `t${++_threadRowId}`, content: "", media: [], emojiTags: [] });

export default function ThreadCompose({
  posts, onChangePosts, publishedCount = 0,
  myPubkey, myProfile, profiles, customEmojis = [], blossomServers = [],
}) {
  const updatePost = (id, next) => onChangePosts(posts.map(p => (p.id === id ? next : p)));
  const removePost = id => onChangePosts(posts.filter(p => p.id !== id));
  const addPost = () => onChangePosts([...posts, makeThreadPost()]);

  return (
    <div className="compose-thread" onClick={e => e.stopPropagation()}>
      {posts.map((post, i) => (
        <div key={post.id}>
          <ThreadPostRow
            post={post}
            index={i}
            canRemove={posts.length > 1 && i >= publishedCount}
            isPosted={i < publishedCount}
            onChange={next => updatePost(post.id, next)}
            onRemove={() => removePost(post.id)}
            myPubkey={myPubkey}
            myProfile={myProfile}
            profiles={profiles}
            customEmojis={customEmojis}
            blossomServers={blossomServers}
          />
          {i < posts.length - 1 && (
            <div className="compose-thread-connector">
              <div className="thread-connector-line chain" />
            </div>
          )}
        </div>
      ))}
      <button type="button" className="compose-thread-add" onClick={addPost}>
        + Add another post
      </button>
    </div>
  );
}
