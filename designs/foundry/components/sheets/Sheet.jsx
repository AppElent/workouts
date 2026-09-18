import React from "react";
import { AppText } from "../core/AppText";
import { TextAction } from "../buttons/TextAction";

/**
 * Bottom sheet presentation. On iOS the app uses a native formSheet or an
 * @expo/ui sheet; this is the shared shape — grabber, 20px top corners,
 * surface ground, scrim behind.
 */
export function Sheet({ title, subtitle, doneLabel = "Done", onDone, detent = "medium", children, style }) {
  const heights = { small: "40%", medium: "62%", large: "88%" };
  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--scrim)", display: "flex", alignItems: "flex-end", zIndex: 30, ...style }}>
      <div
        role="dialog"
        aria-label={title}
        style={{
          width: "100%",
          maxHeight: heights[detent],
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-sm)",
          background: "var(--surface)",
          borderTopLeftRadius: "var(--r-sheet)",
          borderTopRightRadius: "var(--r-sheet)",
          padding: "var(--space-sm) var(--space-md) var(--space-lg)",
          boxShadow: "var(--shadow-sheet)",
          overflow: "hidden",
        }}
      >
        <span style={{ alignSelf: "center", width: "var(--grabber-w)", height: "var(--grabber-h)", borderRadius: "var(--r-pill)", background: "var(--border-strong)" }} />
        <div style={{ display: "flex", alignItems: "center", minHeight: "var(--hit-target)", gap: "var(--space-sm)" }}>
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {title ? <AppText variant="heading">{title}</AppText> : null}
            {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
          </span>
          {onDone ? <TextAction label={doneLabel} onClick={onDone} style={{ fontWeight: 800 }} /> : null}
        </div>
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>{children}</div>
      </div>
    </div>
  );
}
