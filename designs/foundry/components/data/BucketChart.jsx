import React from "react";
import { AppText } from "../core/AppText";

/** Discrete buckets — a week's volume, a month's sessions. Bars, rounded top. */
export function BucketChart({ title, note, points = [], color = "var(--accent-ink)", height = 160, style }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", background: "var(--surface)", border: "var(--border-width) solid var(--border)", borderRadius: "var(--r-lg)", padding: "var(--space-md)", overflow: "hidden", ...style }}>
      <AppText variant="caption" style={{ fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>{title}</AppText>
      {note ? <AppText variant="caption">{note}</AppText> : null}
      {points.length === 0 ? (
        <AppText variant="caption" style={{ padding: "var(--space-lg) 0", textAlign: "center" }}>Not enough data yet.</AppText>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height, borderBottom: "var(--border-width) solid var(--border)", paddingTop: "var(--space-sm)" }}>
          {points.map((p, i) => (
            <span key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
              <span style={{ width: 16, height: Math.max(3, (p.value / max) * (height - 26)), background: color, borderRadius: "3px 3px 0 0" }} />
              <span style={{ fontFamily: "var(--font-system)", fontSize: 9, color: "var(--text-faint)" }}>{p.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
