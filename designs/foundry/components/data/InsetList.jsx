import React from "react";
import { AppText } from "../core/AppText";

/**
 * The iOS inset grouped list — the shape that makes a screen read as an app
 * rather than a stack of web cards. Hairline separators are inset from the
 * leading content, not full-bleed, and the row itself is 48pt with a 17/600
 * title over a 15pt secondary line.
 */
export function InsetList({ header, footer, action, children, style }) {
  const rows = React.Children.toArray(children);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", ...style }}>
      {header || action ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)" }}>
          {header ? (
            <AppText style={{ fontSize: "var(--type-eyebrow-size)", fontWeight: 600, letterSpacing: "var(--type-eyebrow-tracking)", textTransform: "uppercase", color: "var(--text-muted)" }}>{header}</AppText>
          ) : <span />}
          {action}
        </div>
      ) : null}
      <div style={{ background: "var(--surface)", borderRadius: "var(--r-list)", border: "var(--hairline-width) solid var(--border)", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
        {rows.map((row, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <div style={{ height: "var(--hairline-width)", marginLeft: "var(--separator-inset)", background: "var(--separator)" }} /> : null}
            {row}
          </React.Fragment>
        ))}
      </div>
      {footer ? <AppText variant="footnote">{footer}</AppText> : null}
    </div>
  );
}

/** One row of an InsetList. Leading media, title + secondary, trailing value, chevron. */
export function InsetRow({ leading, title, secondary, value, chevron = false, destructive = false, onPress, style }) {
  const [pressed, setPressed] = React.useState(false);
  const interactive = Boolean(onPress);
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onPress}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: "var(--row-min-height)",
        padding: "8px var(--space-md)",
        background: pressed && interactive ? "var(--surface-2)" : "transparent",
        cursor: interactive ? "pointer" : "default",
        ...style,
      }}
    >
      {leading}
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <AppText variant="row" numberOfLines={1} style={destructive ? { color: "var(--danger)" } : null}>{title}</AppText>
        {secondary ? <AppText variant="footnote">{secondary}</AppText> : null}
      </span>
      {value ? <AppText variant="secondary" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</AppText> : null}
      {chevron ? <span aria-hidden="true" style={{ color: "var(--text-faint)", fontSize: 17, fontFamily: "var(--font-system)" }}>›</span> : null}
    </div>
  );
}
