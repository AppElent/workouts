import React from "react";

/** Section label above a group. Uppercase, tracked, muted. */
export function Eyebrow({ children, style }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-system)",
        fontSize: "var(--type-eyebrow-size)",
        fontWeight: 800,
        letterSpacing: "var(--type-eyebrow-tracking)",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
