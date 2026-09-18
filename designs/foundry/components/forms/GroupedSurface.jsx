import React from "react";

/** A composed summary that must stay one visual object — no row dividers. */
export function GroupedSurface({ children, style }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", padding: "var(--space-md)", ...style }}>
      {children}
    </div>
  );
}
