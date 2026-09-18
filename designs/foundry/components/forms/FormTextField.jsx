import React from "react";
import { AppText } from "../core/AppText";

/**
 * Text entry inside a grouped section.
 *
 * iOS does not box a field inside a grouped list — the row IS the field. The
 * label sits left, the text is right-aligned and borderless, and the only
 * focus affordance is the caret plus the keyboard. A bordered rectangle inside
 * an already-bordered group is the single strongest "this is a web form" tell,
 * so `inline` is the default and `stacked` exists only for values too long to
 * share a line (a note, a URL).
 */
export function FormTextField({ label, value, placeholder, error, type = "text", layout = "inline", multiline = false, onChange, style }) {
  const field = {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    color: "var(--text)",
    caretColor: "var(--accent-ink)",
    fontFamily: "var(--font-system)",
    fontSize: "var(--type-row-size)",
    fontWeight: 400,
    padding: 0,
    textAlign: layout === "inline" && !multiline ? "right" : "left",
  };
  const input = multiline ? (
    <textarea
      rows={3}
      value={value}
      placeholder={placeholder}
      aria-label={label}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      style={{ ...field, resize: "none", lineHeight: "var(--line-body)" }}
    />
  ) : (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={error ? true : undefined}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      style={field}
    />
  );

  return (
    <div style={{ padding: "0 var(--space-md)", ...style }}>
      <div
        style={{
          minHeight: "var(--row-min-height)",
          padding: layout === "inline" && !multiline ? "8px 0" : "10px 0",
          display: "flex",
          flexDirection: layout === "inline" && !multiline ? "row" : "column",
          alignItems: layout === "inline" && !multiline ? "center" : "stretch",
          gap: layout === "inline" && !multiline ? 12 : 4,
        }}
      >
        <AppText variant="row" style={{ fontWeight: 400, flex: layout === "inline" && !multiline ? "0 0 auto" : undefined }}>{label}</AppText>
        {input}
      </div>
      {error ? (
        <AppText variant="footnote" role="alert" style={{ display: "block", color: "var(--danger)", paddingBottom: 8 }}>{error}</AppText>
      ) : null}
    </div>
  );
}
