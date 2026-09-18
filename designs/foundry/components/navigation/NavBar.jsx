import React from "react";
import { AppText } from "../core/AppText";

/**
 * iOS native stack header: Liquid Glass material, minimal back chevron, and an
 * optional right toolbar action. In the app this is `Stack.Screen` chrome —
 * never drawn in React Native. This is the HTML stand-in for mocks.
 */
export function NavBar({ title, backLabel, onBack, action, largeTitle = false, statusBar = true, style }) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "var(--glass-chrome)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        borderBottom: "var(--hairline-width) solid var(--glass-hairline)",
        fontFamily: "var(--font-system)",
        ...style,
      }}
    >
      {statusBar ? (
        <div style={{ height: "var(--status-bar-height)", display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 22px 4px", color: "var(--text)", fontSize: 14, fontWeight: 700 }}>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>9:41</span>
          <span style={{ display: "flex", gap: 5, alignItems: "center", opacity: 0.9 }}>
            <span style={{ fontSize: 11 }}>▮▮▮</span>
            <span style={{ fontSize: 11 }}>WiFi</span>
            <span style={{ fontSize: 11 }}>100%</span>
          </span>
        </div>
      ) : null}
      <div style={{ height: "var(--nav-bar-height)", display: "flex", alignItems: "center", padding: "0 var(--space-sm)", gap: "var(--space-xs)" }}>
        <span style={{ flex: "0 0 25%", display: "flex", alignItems: "center" }}>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              style={{ minHeight: "var(--hit-target)", display: "flex", alignItems: "center", gap: 2, border: "none", background: "transparent", color: "var(--accent-ink)", fontFamily: "var(--font-system)", fontSize: "var(--type-nav-action-size)", fontWeight: 500, cursor: "pointer", padding: "0 6px" }}
            >
              <span style={{ fontSize: 26, lineHeight: "22px", fontWeight: 500 }}>‹</span>
              {backLabel}
            </button>
          ) : null}
        </span>
        <AppText numberOfLines={1} style={{ flex: 1, textAlign: "center", fontSize: "var(--type-nav-title-size)", fontWeight: 600, opacity: largeTitle ? 0 : 1 }}>
          {title}
        </AppText>
        <span style={{ flex: "0 0 25%", display: "flex", justifyContent: "flex-end" }}>
          {action ? (
            <button
              type="button"
              onClick={action.onPress}
              disabled={action.disabled}
              style={{ minHeight: "var(--hit-target)", padding: "0 6px", border: "none", background: "transparent", color: "var(--accent-ink)", fontFamily: "var(--font-system)", fontSize: "var(--type-nav-action-size)", fontWeight: 500, opacity: action.disabled ? "var(--disabled-opacity)" : 1, cursor: "pointer" }}
            >
              {action.label}
            </button>
          ) : null}
        </span>
      </div>
      {largeTitle ? (
        <div style={{ padding: "0 var(--screen-gutter) 6px" }}>
          <AppText as="h1" style={{ fontSize: "var(--type-large-title-size)", fontWeight: 700, letterSpacing: "var(--type-large-title-tracking)" }}>{title}</AppText>
        </div>
      ) : null}
    </header>
  );
}
