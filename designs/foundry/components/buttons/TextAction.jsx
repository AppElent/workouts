import React from "react";

/** Cancel, neutral or destructive secondary action. No fill, no border. */
export function TextAction({ label, tone = "accent", disabled, onClick, style }) {
  const [pressed, setPressed] = React.useState(false);
  const color = tone === "destructive" ? "var(--danger)" : tone === "neutral" ? "var(--text)" : "var(--accent-ink)";
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        minHeight: "var(--hit-target)",
        padding: "0 var(--space-md)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--r-md)",
        border: "none",
        background: pressed && !disabled ? "var(--surface-2)" : "transparent",
        color,
        fontFamily: "var(--font-system)",
        fontSize: "var(--type-control-size)",
        fontWeight: 500,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? "var(--disabled-opacity)" : 1,
        ...style,
      }}
    >
      {label}
    </button>
  );
}
