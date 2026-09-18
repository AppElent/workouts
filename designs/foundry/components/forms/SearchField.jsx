import React from "react";

/**
 * The iOS search bar: a 36pt rounded field on the raised surface with a
 * leading magnifier and a clear button once there is text. This is the one
 * input that IS a box on iOS — it sits above a list rather than inside a
 * grouped section.
 */
export function SearchField({ value = "", placeholder = "Search", onChange, onCancel, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, ...style }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: 36,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 8px",
          borderRadius: 10,
          background: "var(--surface-2)",
        }}
      >
        <span aria-hidden="true" style={{ color: "var(--text-faint)", fontSize: 15, fontFamily: "var(--font-system)" }}>⌕</span>
        <input
          type="search"
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text)",
            caretColor: "var(--accent-ink)",
            fontFamily: "var(--font-system)",
            fontSize: "var(--type-row-size)",
            fontWeight: 400,
            padding: 0,
            appearance: "none",
            WebkitAppearance: "none",
          }}
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange && onChange("")}
            style={{ border: "none", background: "transparent", color: "var(--text-faint)", fontFamily: "var(--font-system)", fontSize: 14, cursor: "pointer", padding: 0, minWidth: 20 }}
          >
            ✕
          </button>
        ) : null}
      </div>
      {onCancel && value ? (
        <button
          type="button"
          onClick={onCancel}
          style={{ border: "none", background: "transparent", color: "var(--accent-ink)", fontFamily: "var(--font-system)", fontSize: "var(--type-nav-action-size)", fontWeight: 500, cursor: "pointer", padding: "0 2px" }}
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}
