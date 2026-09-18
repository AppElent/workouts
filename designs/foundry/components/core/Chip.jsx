import React from "react";

/** Compact filter or tag. Pills are allowed here and on the primary action only. */
export function Chip({ label, active = false, color, onClick, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        height: 34,
        padding: "0 14px",
        borderRadius: "var(--r-pill)",
        border: "none",
        cursor: onClick ? "pointer" : "default",
        background: active ? "var(--accent)" : "var(--surface-2)",
        color: active ? "var(--on-accent)" : color || "var(--text-muted)",
        fontFamily: "var(--font-system)",
        fontSize: "var(--type-caption-size)",
        fontWeight: 700,
        whiteSpace: "nowrap",
        textTransform: "none",
        ...style,
      }}
    >
      {label}
    </button>
  );
}
