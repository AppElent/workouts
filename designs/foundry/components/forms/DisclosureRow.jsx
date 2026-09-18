import React from "react";
import { AppText } from "../core/AppText";

/** Progressive disclosure, or navigation to more detail. */
export function DisclosureRow({ label, value, expanded, onPress, style }) {
  const [pressed, setPressed] = React.useState(false);
  const glyph = expanded === undefined ? "›" : expanded ? "−" : "+";
  return (
    <button
      type="button"
      onClick={onPress}
      aria-expanded={expanded === undefined ? undefined : expanded}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: "100%",
        minHeight: "var(--row-min-height)",
        padding: "0 var(--space-md)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)",
        border: "none",
        background: pressed ? "var(--surface-2)" : "transparent",
        cursor: "pointer",
        textAlign: "left",
        ...style,
      }}
    >
      <AppText variant="row" style={{ flex: 1, minWidth: 0 }}>{label}</AppText>
      {value ? <AppText variant="secondary" style={{ color: "var(--text-muted)" }}>{value}</AppText> : null}
      <span style={{ minWidth: 20, textAlign: "center", color: "var(--accent-ink)", fontSize: 20, fontWeight: 700, fontFamily: "var(--font-system)" }}>{glyph}</span>
    </button>
  );
}
