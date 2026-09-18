import React from "react";
import { AppText } from "../core/AppText";

/**
 * A row whose actions are reachable three ways: swipe reveals (never commits),
 * long press opens a menu, and screen readers get named custom actions. Travel
 * is clamped to the buttons' width, so there is no full-swipe-to-delete.
 */
export function SwipeableRow({ actions = [], menuTitle, open = false, onToggle, children, style }) {
  const swipeActions = actions.filter((a) => a.swipe !== false);
  const width = 88 * swipeActions.length;
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--r-card)", ...style }}>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width, display: "flex" }}>
        {swipeActions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onPress}
            style={{
              width: 88,
              minHeight: "var(--hit-target)",
              border: "none",
              background: action.destructive ? "var(--danger-soft)" : "var(--surface-2)",
              color: action.destructive ? "var(--danger)" : "var(--text)",
              fontFamily: "var(--font-system)",
              fontSize: "var(--type-caption-size)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div
        onClick={onToggle}
        style={{
          position: "relative",
          background: "var(--surface)",
          transform: open ? `translateX(-${width}px)` : "translateX(0)",
          transition: "transform var(--dur-base) var(--ease-ios)",
        }}
      >
        {children}
      </div>
      <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        <AppText variant="caption">{menuTitle}</AppText>
      </span>
    </div>
  );
}
