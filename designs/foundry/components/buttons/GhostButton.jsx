import React from "react";

/** The quiet bordered capsule. A compatibility primitive, not the default. */
export function GhostButton({ label, icon, size = "md", loading = false, disabled, fullWidth = false, tone = "neutral", onClick, style }) {
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
        borderRadius: "var(--r-pill)",
        border: "var(--border-width) solid var(--border-strong)",
        padding: "0 var(--space-md)",
        minHeight: size === "lg" ? 52 : "var(--control-height)",
        background: pressed && !off ? "var(--surface-2)" : "transparent",
        color: tone === "destructive" ? "var(--danger)" : "var(--text)",
        fontFamily: "var(--font-system)",
        fontSize: size === "lg" ? "var(--type-heading-size)" : "var(--type-control-size)",
        fontWeight: 500,
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
