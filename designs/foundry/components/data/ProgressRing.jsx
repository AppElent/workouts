import React from "react";
import { AppText } from "../core/AppText";

/** Closed-ring progress. One series, accent ink; the hole carries the number. */
export function ProgressRing({ value = 0, target = 1, size = 56, thickness = 6, color = "var(--accent-ink)", track = "var(--surface-2)", label, style }) {
  const pct = Math.max(0, Math.min(1, target ? value / target : 0));
  return (
    <div
      role="img"
      aria-label={label || value + " of " + target}
      style={{ width: size, height: size, borderRadius: "50%", flex: "0 0 auto", display: "grid", placeItems: "center", background: "conic-gradient(" + color + " 0 " + pct * 100 + "%, " + track + " 0)", ...style }}
    >
      <div style={{ width: size - thickness * 2, height: size - thickness * 2, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center" }}>
        <AppText style={{ fontSize: Math.round(size * 0.26), fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {value}
          {target ? <span style={{ fontSize: Math.round(size * 0.17), fontWeight: 400, color: "var(--text-muted)" }}>/{target}</span> : null}
        </AppText>
      </div>
    </div>
  );
}
