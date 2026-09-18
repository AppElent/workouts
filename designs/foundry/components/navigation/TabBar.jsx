import React from "react";
import { Icon } from "../core/Icon";

/** Native tab bar (five is the ceiling — a sixth collapses into a system "More"). */
export function TabBar({ tabs = [], value, onChange, accessory, style }) {
  return (
    <nav
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 20,
        background: "var(--glass-chrome-strong)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        borderTop: "var(--hairline-width) solid var(--glass-hairline)",
        fontFamily: "var(--font-system)",
        ...style,
      }}
    >
      {accessory ? <div style={{ padding: "var(--space-sm) var(--space-md) 0" }}>{accessory}</div> : null}
      <div style={{ display: "flex", height: "var(--tab-bar-height)", alignItems: "stretch", paddingTop: 4 }}>
        {tabs.map((tab) => {
          const selected = tab.key === value;
          return (
            <button
              key={tab.key}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => onChange && onChange(tab.key)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                border: "none",
                background: "transparent",
                color: selected ? "var(--accent-ink)" : "var(--text-faint)",
                cursor: "pointer",
              }}
            >
              <Icon name={tab.icon} size={22} />
              <span style={{ fontSize: 10, fontWeight: 500 }}>{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ height: "var(--home-indicator-height)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ width: 140, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.35)" }} />
      </div>
    </nav>
  );
}
