import React from "react";

/** The accent-filled capsule. One per screen — the screen's single primary action. */
export function PrimaryButton({ label, icon, size = "md", loading = false, disabled, fullWidth = true, onClick, style }) {
  const [pressed, setPressed] = React.useState(false);
  const off = disabled || loading;
  return (
    <button
      type="button"
      onClick={off ? undefined : onClick}
      disabled={off}
      aria-busy={loading || undefined}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "flex",
        width: fullWidth ? "100%" : "auto",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-sm)",
        border: "none",
        borderRadius: "var(--r-pill)",
        minHeight: size === "lg" ? 52 : "var(--control-height)",
        padding: "0 var(--space-lg)",
        background: pressed && !off ? "var(--accent-pressed)" : "var(--accent)",
        color: "var(--on-accent)",
        fontFamily: "var(--font-system)",
        fontSize: size === "lg" ? "var(--type-heading-size)" : "var(--type-control-size)",
        fontWeight: 600,
        letterSpacing: "-0.2px",
        cursor: off ? "default" : "pointer",
        opacity: off ? "var(--disabled-opacity)" : 1,
        ...style,
      }}
    >
      {loading ? <span aria-hidden="true">···</span> : icon}
      {label}
    </button>
  );
}
