import { Bk, Ck } from "./icons.jsx";
import { displayName, shortNpub } from "../utils.js";

export default function CirclePage({ pubkey, follows = [], profiles, onOpenProfile, onBack }) {
  const ownerName = displayName(pubkey, profiles);

  return (
    <div className="slide-panel-scroll">
      <div className="panel-bar">
        <button type="button" className="back-btn" onClick={onBack}><Bk s={16} /></button>
        <span className="panel-bar-logo">{ownerName}'s Circle</span>
      </div>

      {follows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No frens yet</div>
        </div>
      ) : (
        <div className="circle-grid">
          {follows.map((pk, i) => {
            const fp = profiles?.[pk] || {};
            const fn = displayName(pk, profiles);
            return (
              <div
                className="circle-card"
                key={pk}
                style={{ animationDelay: `${i * 0.04}s` }}
                onClick={() => onOpenProfile?.(pk)}
              >
                <div className="circle-card-inner">
                  <div className="circle-card-av">
                    {fp.picture
                      ? <img src={fp.picture} alt={fn} onError={e => { e.target.style.display = "none"; }} />
                      : fn[0]?.toUpperCase()}
                  </div>
                  <div className="circle-card-info">
                    <div className="circle-card-name">{fn}</div>
                    {fp.nip05 && (
                      <div className="circle-card-nip05"><Ck s={8} />{fp.nip05}</div>
                    )}
                    <div className="circle-card-npub">{shortNpub(pk)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
