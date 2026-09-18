import React from "react";
import { AppText } from "../core/AppText";

const PRESETS = [60, 90, 120, 180];

/** Between-sets countdown. Occupies its own space — it never covers Log set. */
export function RestTimerBar({ remaining = "1:30", paused = false, done = false, defaultSeconds = 90, onAdjust, onTogglePause, onDismiss, onChooseDefault, style }) {
  const glyph = { border: "none", background: "transparent", color: "var(--text-muted)", fontFamily: "var(--font-system)", fontSize: 13, fontWeight: 800, cursor: "pointer", minWidth: 36, minHeight: 36 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", padding: "var(--space-xs) var(--space-md)", background: "var(--bg)", ...style }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-sm)",
          minHeight: 52,
          padding: "0 var(--space-md)",
          borderRadius: "var(--r-pill)",
          background: "var(--surface-2)",
          border: "var(--border-width) solid",
          borderColor: done ? "var(--accent-ink)" : "var(--border-strong)",
        }}
      >
        <button type="button" aria-label="Subtract 15 seconds" onClick={() => onAdjust && onAdjust(-15)} style={glyph}>−15</button>
        <button type="button" onClick={onTogglePause} style={{ ...glyph, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 88 }}>
          <AppText style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{done ? "Rest over" : remaining}</AppText>
          {paused ? <span style={{ fontSize: 9, color: "var(--text-muted)" }}>paused</span> : null}
        </button>
        <button type="button" aria-label="Add 15 seconds" onClick={() => onAdjust && onAdjust(15)} style={glyph}>+15</button>
        <button type="button" aria-label="Dismiss rest timer" onClick={onDismiss} style={{ ...glyph, fontSize: 15 }}>✕</button>
      </div>
      <div style={{ display: "flex", gap: "var(--space-xs)", justifyContent: "center" }}>
        {PRESETS.map((seconds) => {
          const active = seconds === defaultSeconds;
          return (
            <button
              key={seconds}
              type="button"
              onClick={() => onChooseDefault && onChooseDefault(seconds)}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--r-pill)",
                border: "none",
                background: active ? "var(--accent)" : "var(--surface)",
                color: active ? "var(--on-accent)" : "var(--text-muted)",
                fontFamily: "var(--font-system)",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {seconds}s
            </button>
          );
        })}
      </div>
    </div>
  );
}
