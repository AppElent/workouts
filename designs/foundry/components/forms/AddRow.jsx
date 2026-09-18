import React from "react";
import { AppText } from "../core/AppText";

/** Add an item inside the section it affects. */
export function AddRow({ label, onPress, style }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onPress}
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
      <span style={{ color: "var(--accent-ink)", fontSize: 19, fontWeight: 700, fontFamily: "var(--font-system)" }}>＋</span>
      <AppText style={{ flex: 1, color: "var(--accent-ink)", fontWeight: 500, fontSize: "var(--type-row-size)" }}>{label}</AppText>
    </button>
  );
}
