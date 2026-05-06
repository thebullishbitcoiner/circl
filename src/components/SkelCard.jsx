export default function SkelCard() {
  return (
    <div className="skel-card">
      <div className="skel-row">
        <div className="skel skel-av" />
        <div className="skel-lines">
          <div className="skel skel-line" style={{ width: "40%" }} />
          <div className="skel skel-line" style={{ width: "88%" }} />
          <div className="skel skel-line" style={{ width: "65%" }} />
        </div>
      </div>
    </div>
  );
}
