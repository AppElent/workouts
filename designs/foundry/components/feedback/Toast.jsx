import React from "react";
import { AppText } from "../core/AppText";

/** A mutation that fails must say so. Success toasts are the exception, not the habit. */
export function Toast({ kind = "error", message, onDismiss, style }) {
  const tone = kind === "error"
    ? { background: "var(--danger-soft)", borderColor: "var(--danger)" }
    : { background: "var(--accent-dim)", borderColor: "var(--accent-ink)" };
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      onClick={onDismiss}
      style={{
        borderRadius: "var(--r-lg)",
        border: "var(--border-width) solid",
        padding: "10px var(--space-md)",
        cursor: onDismiss ? "pointer" : "default",
        ...tone,
        ...style,
      }}
    >
      <AppText>{message}</AppText>
    </div>
  );
}
