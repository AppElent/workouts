import React from "react";
import { AppText } from "../core/AppText";

/**
 * Leading image for a list row: exercise thumbnails, Open Food Facts product
 * shots, a meal photo. Square by default because a row is height-bound.
 *
 * Every photo is optional by contract — the app has rows with no image and
 * rows whose remote image has not arrived, so the fallback is a first-class
 * state, not an error: the muted initial on a raised surface.
 */
export function MediaThumb({ src, alt = "", size = 44, radius = 10, fallback, style }) {
  const [failed, setFailed] = React.useState(false);
  const show = src && !failed;
  return (
    <div style={{ width: size, height: size, borderRadius: radius, overflow: "hidden", flex: "0 0 auto", background: "var(--surface-2)", display: "grid", placeItems: "center", ...style }}>
      {show ? (
        <img src={src} alt={alt} onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <AppText style={{ fontSize: Math.round(size * 0.34), fontWeight: 600, color: "var(--text-faint)" }}>
          {(fallback || alt || "?").slice(0, 1).toUpperCase()}
        </AppText>
      )}
    </div>
  );
}
