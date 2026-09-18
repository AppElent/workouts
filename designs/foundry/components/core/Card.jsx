import React from "react";

/** A card represents an actual object or summary — never a container for arbitrary form fields. */
export function Card({ tone = "default", style, children, ...rest }) {
  const tones = {
    default: { background: "var(--surface)", borderColor: "var(--border)" },
    accent: { background: "var(--accent-dim)", borderColor: "var(--accent-ink)" },
  };
  return (
    <div
      style={{
        border: "var(--border-width) solid",
        borderRadius: "var(--r-list)",
        padding: "14px var(--space-md)",
        boxShadow: "var(--shadow-card)",
        fontFamily: "var(--font-system)",
        ...tones[tone],
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
