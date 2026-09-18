import React from "react";
import { AppText } from "../core/AppText";

/** A grouped section: label outside, hairline separators between rows inside. */
export function FormSection({ title, footer, children, style }) {
  const rows = React.Children.toArray(children);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", ...style }}>
      {title ? <AppText variant="label">{title}</AppText> : null}
      <div style={{ background: "var(--surface)", borderRadius: "var(--r-list)", overflow: "hidden", border: "var(--hairline-width) solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        {rows.map((row, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <div style={{ height: "var(--hairline-width)", marginLeft: "var(--separator-inset)", background: "var(--separator)" }} /> : null}
            {row}
          </React.Fragment>
        ))}
      </div>
      {footer ? <AppText variant="caption">{footer}</AppText> : null}
    </div>
  );
}
