import React from "react";
import { AppText } from "../core/AppText";
import { GhostButton } from "../buttons/GhostButton";

/** The only way a destructive action asks. Confirm labels are verbs, never "OK". */
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel = "Keep", destructive = false, onConfirm, onCancel, style }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-lg)",
        zIndex: 40,
        ...style,
      }}
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-sm)",
          background: "var(--surface)",
          border: "var(--border-width) solid var(--border)",
          borderRadius: "var(--r-sheet)",
          padding: "var(--space-lg)",
          boxShadow: "var(--shadow-menu)",
        }}
      >
        <AppText variant="heading">{title}</AppText>
        {message ? <AppText variant="caption">{message}</AppText> : null}
        <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
          <GhostButton label={cancelLabel} onClick={onCancel} style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              minHeight: "var(--hit-target)",
              borderRadius: "var(--r-pill)",
              border: "none",
              padding: "0 var(--space-md)",
              background: destructive ? "var(--danger)" : "var(--accent)",
              color: destructive ? "var(--text)" : "var(--on-accent)",
              fontFamily: "var(--font-system)",
              fontSize: "var(--type-body-size)",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
