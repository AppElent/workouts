import React from "react";
import { AppText } from "../core/AppText";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month grid, Monday-first. Cells are 44pt minimum and announce their state. */
export function NutritionCalendar({ monthLabel = "September 2026", offset = 1, days = 30, selected, today, onSelect, style }) {
  const cells = [...Array.from({ length: offset }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const nav = { minWidth: "var(--hit-target)", minHeight: "var(--hit-target)", border: "none", background: "transparent", color: "var(--accent-ink)", fontSize: 26, fontFamily: "var(--font-system)", cursor: "pointer", borderRadius: "var(--r-pill)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", ...style }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button type="button" aria-label="Previous month" style={nav}>‹</button>
        <AppText variant="heading" style={{ flex: 1, textAlign: "center" }}>{monthLabel}</AppText>
        <button type="button" aria-label="Next month" style={nav}>›</button>
      </div>
      <div style={{ display: "flex" }}>
        {WEEKDAYS.map((d) => (
          <AppText key={d} variant="caption" style={{ flex: 1, textAlign: "center", fontWeight: 700 }}>{d}</AppText>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} style={{ minHeight: "var(--hit-target)" }} />;
          const isSelected = day === selected;
          const isToday = day === today;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect && onSelect(day)}
              style={{
                minHeight: "var(--hit-target)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--r-pill)",
                border: isToday && !isSelected ? "var(--border-width) solid var(--accent-ink)" : "var(--border-width) solid transparent",
                background: isSelected ? "var(--accent)" : "transparent",
                color: isSelected ? "var(--on-accent)" : "var(--text)",
                fontFamily: "var(--font-system)",
                fontSize: "var(--type-body-size)",
                fontWeight: isSelected ? 800 : 500,
                cursor: "pointer",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => onSelect && today && onSelect(today)} style={{ alignSelf: "center", padding: "var(--space-sm)", minHeight: "var(--hit-target)", border: "none", background: "transparent", color: "var(--accent-ink)", fontFamily: "var(--font-system)", fontWeight: 500, cursor: "pointer" }}>
        Today
      </button>
    </div>
  );
}
