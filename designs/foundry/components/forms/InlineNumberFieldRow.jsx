import React from "react";
import { AppText } from "../core/AppText";

/**
 * Numeric entry as a row: label left, right-aligned tabular number, unit, and
 * an optional accessory. Borderless like `FormTextField` — the number sits on
 * the group's own surface rather than in a box of its own.
 */
export function InlineNumberFieldRow({ label, value, suffix, accessory, onChange, style }) {
  return (
    <div
      style={{
        minHeight: "var(--row-min-height)",
        padding: "8px var(--space-md)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        ...style,
      }}
    >
      <AppText variant="row" style={{ fontWeight: 400, flex: 1, minWidth: 0 }}>{label}</AppText>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <input
          inputMode="decimal"
          value={value}
          aria-label={label}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          style={{
            width: 64,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text)",
            caretColor: "var(--accent-ink)",
            fontFamily: "var(--font-system)",
            fontSize: "var(--type-row-size)",
            fontWeight: 400,
            fontVariantNumeric: "tabular-nums",
            textAlign: "right",
            padding: 0,
          }}
        />
        {suffix ? <AppText variant="secondary" style={{ minWidth: 26 }}>{suffix}</AppText> : null}
        {accessory}
      </div>
    </div>
  );
}
