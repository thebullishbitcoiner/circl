import { useState, useEffect, useMemo } from "react";

function buildBolt(startX, startY, angle, length, depth = 0) {
  const segments = 3 + Math.floor(Math.random() * 2);
  const pts = [[startX, startY]];
  let x = startX, y = startY;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const px = -sin, py = cos;

  for (let i = 1; i <= segments; i++) {
    const t      = i / segments;
    const step   = (length / segments) * (0.7 + Math.random() * 0.6);
    const jitter = (Math.random() - 0.5) * length * 0.45 * (1 - t * 0.5);
    x += cos * step + px * jitter;
    y += sin * step + py * jitter;
    pts.push([x, y]);
  }

  const trunk = "M " + pts.map(p => p.map(v => v.toFixed(1)).join(",")).join(" L ");
  const paths = [{ d: trunk, width: 1.8 - depth * 0.5, tip: [x, y] }];

  if (depth < 2 && Math.random() > 0.3) {
    const forkAngle1 = angle + (0.3 + Math.random() * 0.4);
    const forkAngle2 = angle - (0.3 + Math.random() * 0.4);
    const forkLen    = length * (0.4 + Math.random() * 0.3);
    paths.push(...buildBolt(x, y, forkAngle1, forkLen, depth + 1));
    if (Math.random() > 0.45)
      paths.push(...buildBolt(x, y, forkAngle2, forkLen * 0.7, depth + 1));
  }
  return paths;
}

export default function ZapAnimation({ cx, cy, onDone }) {
  const side = Math.floor(Math.random() * 3);
  const W = window.innerWidth, H = window.innerHeight;
  const [ox, oy] = side === 0
    ? [W * (0.1 + Math.random() * 0.8), -40]
    : side === 1
    ? [-40, H * (0.05 + Math.random() * 0.5)]
    : [W + 40, H * (0.05 + Math.random() * 0.5)];

  const buildPath = () => {
    const pts   = [[ox, oy]];
    const steps = 5 + Math.floor(Math.random() * 3);
    for (let i = 1; i < steps; i++) {
      const t    = i / steps;
      const bx   = ox + (cx - ox) * t;
      const by   = oy + (cy - oy) * t;
      const perp = { x: -(cy - oy), y: (cx - ox) };
      const plen = Math.sqrt(perp.x ** 2 + perp.y ** 2) || 1;
      const jitter = (Math.random() - 0.5) * 90 * (1 - t);
      pts.push([bx + (perp.x / plen) * jitter, by + (perp.y / plen) * jitter]);
    }
    pts.push([cx, cy]);
    return "M " + pts.map(p => p.map(Math.round).join(",")).join(" L ");
  };

  const path     = buildPath();
  const totalLen = 700;

  const bolts = useMemo(() => {
    const result = [];
    for (let i = 0; i < 8; i++) {
      const angle  = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const length = 28 + Math.random() * 32;
      const paths  = buildBolt(cx, cy, angle, length);
      result.push({ paths, color: "#F5A623", delay: Math.random() * 35 });
    }
    return result;
  }, []);

  const [drawn, setDrawn] = useState(false);
  const [phase, setPhase] = useState("strike");

  useEffect(() => {
    const prevent = e => e.preventDefault();
    document.addEventListener("touchmove", prevent, { passive: false });
    document.addEventListener("wheel",     prevent, { passive: false });
    const t0 = setTimeout(() => setDrawn(true),   16);
    const t1 = setTimeout(() => setPhase("impact"), 180);
    const t2 = setTimeout(() => setPhase("fade"),   300);
    const t3 = setTimeout(onDone, 480);
    return () => {
      document.removeEventListener("touchmove", prevent);
      document.removeEventListener("wheel",     prevent);
      [t0, t1, t2, t3].forEach(clearTimeout);
    };
  }, []);

  const impacted = phase !== "strike";
  const faded    = phase === "fade";

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
        <path d={path} fill="none" stroke="#F5A623" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={totalLen}
          style={{
            strokeDashoffset: drawn && phase === "strike" ? 0 : totalLen,
            opacity: faded ? 0 : 1,
            transition: drawn && phase === "strike"
              ? "stroke-dashoffset 0.16s cubic-bezier(.4,0,.2,1)"
              : faded ? "opacity 0.1s ease-in" : "none",
          }}
        />
        {impacted && (
          <circle cx={cx} cy={cy}
            r={faded ? 36 : 5}
            fill="none" stroke="#F5A623" strokeWidth={faded ? 0.3 : 2.5}
            opacity={faded ? 0 : 0.9}
            style={{ transition: "r 0.14s cubic-bezier(.2,.8,.2,1), opacity 0.12s ease, stroke-width 0.12s ease" }}
          />
        )}
        {impacted && bolts.map((bolt, bi) =>
          bolt.paths.map((seg, si) => (
            <path key={`${bi}-${si}`} d={seg.d} fill="none" stroke={bolt.color}
              strokeWidth={faded ? 0 : seg.width} strokeLinecap="round" strokeLinejoin="round"
              opacity={faded ? 0 : (si === 0 ? 0.95 : 0.65 - si * 0.1)}
              style={{
                transition: `opacity ${faded ? "0.08s" : "0s"} ease, stroke-width ${faded ? "0.08s" : "0s"} ease`,
                transitionDelay: faded ? `${bolt.delay * 0.5}ms` : "0ms",
              }}
            />
          ))
        )}
      </svg>
    </div>
  );
}
