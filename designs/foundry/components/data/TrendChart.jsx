import React from "react";
import { AppText } from "../core/AppText";

/** A trend over time. Needs two points — a single dot is not a line. */
export function TrendChart({ title, note, points = [], color = "var(--accent-ink)", height = 160, style }) {
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = points.length > 1 ? (i / (points.length - 1)) * 100 : 50;
    const y = 100 - ((p.value - min) / span) * 88 - 6;
    return { x, y, ...p };
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", background: "var(--surface)", border: "var(--border-width) solid var(--border)", borderRadius: "var(--r-lg)", padding: "var(--space-md)", overflow: "hidden", ...style }}>
      <AppText variant="caption" style={{ fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>{title}</AppText>
      {note ? <AppText variant="caption">{note}</AppText> : null}
      {points.length < 2 ? (
        <AppText variant="caption" style={{ padding: "var(--space-lg) 0", textAlign: "center" }}>Not enough data yet.</AppText>
      ) : (
        <>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height, borderBottom: "var(--border-width) solid var(--border)" }}>
            <polyline
              points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
              fill="none"
              stroke={color}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {coords.map((c, i) => (
              <circle key={i} cx={c.x} cy={c.y} r="1.2" fill={color} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {coords.map((c, i) => (
              <span key={i} style={{ fontFamily: "var(--font-system)", fontSize: 9, color: "var(--text-faint)" }}>{c.label}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
