import React from "react";

const RAMP = {
  display: { fontSize: "var(--type-display-size)", fontWeight: 800 },
  title: { fontSize: "var(--type-title-size)", fontWeight: 800 },
  metric: { fontSize: "var(--type-metric-size)", fontWeight: 800, fontVariantNumeric: "tabular-nums" },
  heading: { fontSize: "var(--type-heading-size)", fontWeight: 700 },
  body: { fontSize: "var(--type-body-size)", fontWeight: 500 },
  label: { fontSize: "var(--type-label-size)", fontWeight: 600, color: "var(--text-muted)" },
  caption: { fontSize: "var(--type-caption-size)", fontWeight: 500, color: "var(--text-muted)" },
  /* Native iOS styles — what grouped lists and chrome should use. */
  row: { fontSize: "var(--type-row-size)", fontWeight: 600, letterSpacing: "var(--type-row-tracking)" },
  secondary: { fontSize: "var(--type-secondary-size)", fontWeight: 400, color: "var(--text-muted)" },
  footnote: { fontSize: "var(--type-footnote-size)", fontWeight: 400, color: "var(--text-muted)" },
};

/** The only component allowed to set a font size. Screens pass a ramp name. */
export function AppText({ variant = "body", as = "span", numberOfLines, style, children, ...rest }) {
  const Tag = as;
  const clamp = numberOfLines
    ? { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: numberOfLines, overflow: "hidden" }
    : null;
  return (
    <Tag
      style={{
        fontFamily: "var(--font-system)",
        color: "var(--text)",
        lineHeight: "var(--line-body)",
        margin: 0,
        ...RAMP[variant],
        ...clamp,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
