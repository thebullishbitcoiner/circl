import { memo } from "react";
import { avatarUrl, avatarInitial } from "../utils.js";

function Avatar({ pk, profiles, size = 36, className = "" }) {
  const url  = avatarUrl(pk, profiles);
  const init = avatarInitial(pk, profiles);
  return (
    <div className={`avatar ${className}`} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {url
        ? <img src={url} alt={init} onError={e => { e.target.style.display = "none"; }} />
        : init}
    </div>
  );
}

export default memo(Avatar, (prev, next) =>
  prev.pk === next.pk &&
  prev.size === next.size &&
  prev.className === next.className &&
  prev.profiles[prev.pk] === next.profiles[next.pk]
);
