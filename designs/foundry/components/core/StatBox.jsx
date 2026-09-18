import React from "react";

/** One number that is the point, with its uppercase label under it. */
export function StatBox({ value, unit, label, color, style }) {
  return (
    <div
      style={{
        flex: 1,
        background: "var(--surface)",
        borderRadius: 16,
        padding: "15px 13px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
        fontFamily: "var(--font-system)",
        ...style,
      }}
    >
      <span style={{ fontSize: "var(--type-stat-value-size)", fontWeight: 800, color: color || "var(--text)", fontVariantNumeric: "tabular-nums" }}>
        {value}
        {unit ? <span style={{ fontSize: "var(--type-caption-size)", fontWeight: 700, color: "var(--text-muted)" }}> {unit}</span> : null}
      </span>
      <span style={{ fontSize: "var(--type-stat-label-size)", fontWeight: 800, letterSpacing: "var(--type-stat-label-tracking)", textTransform: "uppercase", color: "var(--text-muted)" }}>
        {label}
      </span>
    </div>
  );
}
