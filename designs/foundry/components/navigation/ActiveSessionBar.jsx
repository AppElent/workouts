import React from "react";
import { AppText } from "../core/AppText";

/** Resume control — in the iOS 26 tab accessory, or inline above the tabs below that. */
export function ActiveSessionBar({ name = "Free session", elapsed, onPress, style }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label="Resume active workout"
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)",
        minHeight: "var(--hit-target)",
        padding: "0 var(--space-md)",
        borderRadius: "var(--r-pill)",
        border: "none",
        background: "var(--surface-2)",
        cursor: "pointer",
        textAlign: "left",
        ...style,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "var(--r-pill)", background: "var(--accent)", flex: "0 0 auto" }} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <AppText variant="caption" style={{ color: "var(--accent-ink)", letterSpacing: 0.4, textTransform: "uppercase" }}>In progress</AppText>
        <AppText numberOfLines={1} style={{ fontWeight: 700 }}>{name}</AppText>
      </span>
      {elapsed ? <AppText style={{ color: "var(--text-muted)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{elapsed}</AppText> : null}
      <AppText style={{ color: "var(--accent-ink)", fontWeight: 600 }}>Resume</AppText>
    </button>
  );
}
