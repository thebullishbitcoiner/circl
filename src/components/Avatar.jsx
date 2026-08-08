import { memo } from "react";
import { avatarUrl, avatarInitial } from "../utils.js";
import { useIsInnerCircl } from "../hooks/useInnerCirclBadge.js";

function Avatar({ pk, profiles, size = 36, className = "" }) {
  const url  = avatarUrl(pk, profiles);
  const init = avatarInitial(pk, profiles);
  const isInnerCircl = useIsInnerCircl(pk);

  const content = url
    ? <img src={url} alt={init} onError={e => { e.target.style.display = "none"; }} />
    : init;

  if (!isInnerCircl) {
    return (
      <div className={`avatar ${className}`} style={{ width: size, height: size, fontSize: size * 0.4 }}>
        {content}
      </div>
    );
  }

  const ringWidth = Math.max(2, Math.round(size * 0.045));
  return (
    <div className="avatar-inner-circl-ring" style={{ width: size, height: size, padding: ringWidth }}>
      <div className={`avatar ${className}`} style={{ width: "100%", height: "100%", fontSize: size * 0.4 }}>
        {content}
      </div>
    </div>
  );
}

export default memo(Avatar, (prev, next) =>
  prev.pk === next.pk &&
  prev.size === next.size &&
  prev.className === next.className &&
  prev.profiles[prev.pk] === next.profiles[next.pk]
);
