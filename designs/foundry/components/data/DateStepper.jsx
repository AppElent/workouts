import React from "react";
import { AppText } from "../core/AppText";

/** Previous/next around a formatted date. Tapping the date opens a picker. */
export function DateStepper({ label, secondaryLabel, onPrevious, onNext, onChooseDate, style }) {
  const btn = {
    minWidth: "var(--hit-target)",
    minHeight: "var(--hit-target)",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--r-pill)",
    border: "none",
    background: "transparent",
    color: "var(--accent-ink)",
    fontFamily: "var(--font-system)",
    fontSize: "var(--type-heading-size)",
    fontWeight: 700,
    cursor: "pointer",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", ...style }}>
      <button type="button" aria-label="Previous day" onClick={onPrevious} style={btn}>‹</button>
      <button type="button" onClick={onChooseDate} style={{ flex: 1, minHeight: "var(--hit-target)", border: "none", background: "transparent", cursor: onChooseDate ? "pointer" : "default", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <AppText style={{ textAlign: "center", fontWeight: 700 }}>{label}</AppText>
        {secondaryLabel ? <AppText variant="caption" style={{ textAlign: "center" }}>{secondaryLabel}</AppText> : null}
      </button>
      <button type="button" aria-label="Next day" onClick={onNext} style={btn}>›</button>
    </div>
  );
}
