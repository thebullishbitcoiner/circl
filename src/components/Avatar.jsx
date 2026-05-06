import { avatarUrl, avatarInitial } from "../utils.js";

export default function Avatar({ pk, profiles, size = 36, className = "" }) {
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
