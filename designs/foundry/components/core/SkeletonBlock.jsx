import React from "react";

/** Deliberately still: no shimmer, so Reduce Motion needs no branch. */
export function SkeletonBlock({ width = "100%", height = 14, style }) {
  return (
    <div
      style={{
        width,
        height,
        background: "var(--surface-2)",
        borderRadius: Math.min(height / 2, 8),
        ...style,
      }}
    />
  );
}

/** Wraps a set of blocks so a screen reader hears one label, not eleven rectangles. */
export function SkeletonGroup({ label, children, style }) {
  return (
    <div aria-label={label} role="status" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", ...style }}>
      {children}
    </div>
  );
}
