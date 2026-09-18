import React from "react";

/**
 * SF Symbols stand-in for HTML mocks. The app itself renders real SF Symbols
 * through expo-symbols / NativeTabs (`sf="house.fill"`); the web cannot, so
 * this maps the symbol names the app uses onto their nearest Lucide glyph.
 * Load `<script src="https://cdn.jsdelivr.net/npm/iconify-icon@2/dist/iconify-icon.min.js">` once per page.
 */
const SF_TO_LUCIDE = {
  "house.fill": "house",
  "play.fill": "play",
  "fork.knife": "utensils",
  "chart.bar.fill": "chart-column",
  "person.fill": "user",
  magnifyingglass: "search",
  trash: "trash-2",
  "arrow.right": "arrow-right",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  plus: "plus",
  minus: "minus",
  xmark: "x",
  ellipsis: "ellipsis",
  "barcode.viewfinder": "scan-barcode",
  "square.and.pencil": "square-pen",
  "timer": "timer",
  "flame.fill": "flame",
};

export function Icon({ name, size = 20, color = "currentColor", style, ...rest }) {
  const glyph = SF_TO_LUCIDE[name] || name;
  return (
    <iconify-icon
      icon={`lucide:${glyph}`}
      width={size}
      height={size}
      style={{ color, display: "inline-flex", flex: "0 0 auto", ...style }}
      {...rest}
    />
  );
}
