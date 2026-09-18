import React from "react";
import { AppText } from "../core/AppText";

/**
 * Bounded numeric adjustment.
 *
 * `compact` is the platform stepper: a 32pt two-button segment with a hairline
 * divider, placed as a row accessory next to the value. `field` is the larger
 * standalone control the set logger uses, where weight and reps are the point
 * of the screen and the thumb should not have to aim.
 */
export function StepperField({ label, value = 0, step = 1, min = 0, onChange, height = 48, variant = "field", style }) {
  const round = (n) => Math.round(n * 10) / 10;
  const dec = () => onChange && onChange(round(Math.max(min, value - step)));
  const inc = () => onChange && onChange(round(value + step));

  if (variant === "compact") {
    const btn = {
      width: 42,
      height: 32,
      display: "grid",
      placeItems: "center",
      border: "none",
      background: "transparent",
      color: "var(--accent-ink)",
      fontFamily: "var(--font-system)",
      fontSize: 17,
      fontWeight: 500,
      cursor: "pointer",
    };
    return (
      <div style={{ display: "flex", alignItems: "center", borderRadius: 8, background: "var(--surface-2)", overflow: "hidden", flex: "0 0 auto", ...style }}>
        <button type="button" aria-label={"Decrease " + label} onClick={dec} style={btn}>−</button>
        <span style={{ width: "var(--hairline-width)", alignSelf: "stretch", background: "var(--border-strong)" }} />
        <button type="button" aria-label={"Increase " + label} onClick={inc} style={btn}>＋</button>
      </div>
    );
  }

  const btn = {
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    border: "none",
    background: "transparent",
    color: "var(--accent-ink)",
    fontFamily: "var(--font-system)",
    fontSize: 20,
    fontWeight: 500,
    cursor: "pointer",
  };
  return (
    <div
      style={{
        flex: 1,
        minWidth: 96,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 2px",
        borderRadius: "var(--r-lg)",
        background: "var(--surface-2)",
        ...style,
      }}
    >
      <button type="button" aria-label={"Decrease " + label} onClick={dec} style={btn}>−</button>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        <AppText style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.4px" }}>{value}</AppText>
        <AppText style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>{label}</AppText>
      </span>
      <button type="button" aria-label={"Increase " + label} onClick={inc} style={btn}>＋</button>
    </div>
  );
}
