import React from "react";

const SPORTS = {
  strength: { glyph: "S", color: "var(--sport-strength)", dim: "var(--sport-strength-dim)" },
  running: { glyph: "R", color: "var(--sport-running)", dim: "var(--sport-running-dim)" },
  cycling: { glyph: "C", color: "var(--sport-cycling)", dim: "var(--sport-cycling-dim)" },
  wod: { glyph: "W", color: "var(--sport-wod)", dim: "var(--sport-wod-dim)" },
};

/** The tinted tile that stands in for an activity type. Letter glyph, not an illustration. */
export function SportIcon({ sport = "strength", size = 34, style }) {
  const meta = SPORTS[sport] || SPORTS.strength;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: meta.dim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        ...style,
      }}
    >
      <span style={{ fontFamily: "var(--font-system)", color: meta.color, fontWeight: 800, fontSize: size * 0.4 }}>
        {meta.glyph}
      </span>
    </div>
  );
}
