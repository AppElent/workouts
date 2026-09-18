import React from "react";
import { AppText } from "../core/AppText";

/** Mutually exclusive choices. Selection is announced, not only drawn. */
export function Segmented({ options = [], value, onChange, style }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-sm)", ...style }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={option.accessibilityLabel || option.label}
            onClick={() => onChange && onChange(option.value)}
            style={{
              flex: 1,
              minHeight: "var(--hit-target)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 var(--space-sm)",
              border: "var(--border-width) solid",
              borderColor: selected ? "var(--accent)" : "var(--border)",
              borderRadius: "var(--r-lg)",
              background: selected ? "var(--accent)" : "var(--surface)",
              cursor: "pointer",
            }}
          >
            <AppText numberOfLines={2} style={{ fontWeight: 700, textAlign: "center", color: selected ? "var(--on-accent)" : "var(--text)" }}>
              {option.label}
            </AppText>
          </button>
        );
      })}
    </div>
  );
}
