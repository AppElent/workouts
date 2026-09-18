import React from "react";
import { AppText } from "./AppText";
import { GhostButton } from "../buttons/GhostButton";

/** What a region says when it holds nothing yet. */
export function EmptyState({ title, body, action, appearance = "default", style }) {
  const search = appearance === "search";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: search ? "var(--space-md)" : "var(--space-sm)",
        ...(search
          ? { minHeight: 320, alignItems: "center", justifyContent: "center", padding: "var(--space-xxl) var(--space-xl)", textAlign: "center" }
          : {}),
        ...style,
      }}
    >
      {search ? <span aria-hidden="true" style={{ fontSize: 46, color: "var(--text-faint)" }}>⌕</span> : null}
      {title ? <AppText variant="heading">{title}</AppText> : null}
      <AppText variant="caption" style={search ? { maxWidth: 320 } : null}>{body}</AppText>
      {action ? (
        <div style={{ alignSelf: search ? "center" : "flex-start", marginTop: "var(--space-xs)" }}>
          <GhostButton label={action.label} onClick={action.onPress} />
        </div>
      ) : null}
    </div>
  );
}
