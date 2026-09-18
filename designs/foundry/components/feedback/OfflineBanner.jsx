import React from "react";
import { AppText } from "../core/AppText";

/** Takes layout space, has no dismiss, and disappears when the condition does. */
export function OfflineBanner({ message = "Offline — changes sync when you reconnect", style }) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "var(--space-xs) var(--space-md)",
        background: "var(--warn-soft)",
        borderBottom: "var(--border-width) solid var(--warn-border)",
        ...style,
      }}
    >
      <AppText variant="caption" style={{ color: "var(--warn)", fontWeight: 600 }}>{message}</AppText>
    </div>
  );
}
