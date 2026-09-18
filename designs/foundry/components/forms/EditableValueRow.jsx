import React from "react";
import { AppText } from "../core/AppText";

/** A saved repeated value, summarised in one row, with an optional visible delete. */
export function EditableValueRow({ label, value, deleteLabel, onPress, onDelete, style }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <div style={{ display: "flex", alignItems: "stretch", ...style }}>
      <button
        type="button"
        onClick={onPress}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        style={{
          flex: 1,
          minHeight: 56,
          padding: "var(--space-sm) 0 var(--space-sm) var(--space-md)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-sm)",
          border: "none",
          background: pressed ? "var(--surface-2)" : "transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <AppText variant="row">{label}</AppText>
          <AppText variant="caption">{value}</AppText>
        </span>
        <span style={{ color: "var(--text-faint)", fontSize: 24, fontFamily: "var(--font-system)" }}>›</span>
      </button>
      {onDelete && deleteLabel ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${deleteLabel} ${label}`}
          style={{
            minWidth: 72,
            padding: "0 var(--space-sm)",
            border: "none",
            background: "transparent",
            color: "var(--danger)",
            fontFamily: "var(--font-system)",
            fontSize: "var(--type-caption-size)",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {deleteLabel}
        </button>
      ) : null}
    </div>
  );
}
