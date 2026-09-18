import React from "react";
import { AppText } from "../core/AppText";

/**
 * A photo card for one object: today's workout, a routine, a progress photo.
 * The image is 16:9 and the copy sits below it on the opaque surface rather
 * than over the photo — text on an uncontrolled image is the one place this
 * system will not gamble on contrast. Use `overlay` only with an image you
 * control, and it adds a protection gradient.
 */
export function HeroCard({ src, alt = "", eyebrow, title, subtitle, meta, overlay = false, ratio = "16 / 9", action, onPress, style }) {
  const copy = (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {eyebrow ? (
        <AppText style={{ fontSize: "var(--type-eyebrow-size)", fontWeight: 600, letterSpacing: "var(--type-eyebrow-tracking)", textTransform: "uppercase", color: overlay ? "rgba(255,255,255,0.82)" : "var(--text-muted)" }}>{eyebrow}</AppText>
      ) : null}
      <AppText variant="heading" style={overlay ? { color: "#ffffff" } : null}>{title}</AppText>
      {subtitle ? <AppText variant="footnote" style={overlay ? { color: "rgba(255,255,255,0.86)" } : null}>{subtitle}</AppText> : null}
      {meta ? <AppText variant="footnote" style={{ color: overlay ? "rgba(255,255,255,0.72)" : "var(--text-faint)" }}>{meta}</AppText> : null}
    </div>
  );

  return (
    <div
      onClick={onPress}
      style={{
        position: "relative",
        borderRadius: "var(--r-list)",
        overflow: "hidden",
        background: "var(--surface)",
        border: "var(--hairline-width) solid var(--border)",
        boxShadow: "var(--shadow-card)",
        cursor: onPress ? "pointer" : "default",
        ...style,
      }}
    >
      <div style={{ aspectRatio: ratio, background: "var(--surface-2)", position: "relative" }}>
        {src ? <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
        {overlay ? (
          <>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,11,9,0.86) 0%, rgba(10,11,9,0.35) 45%, rgba(10,11,9,0) 100%)" }} />
            <div style={{ position: "absolute", left: "var(--space-md)", right: "var(--space-md)", bottom: 14 }}>{copy}</div>
          </>
        ) : null}
      </div>
      {overlay ? null : (
        <div style={{ padding: "12px var(--space-md) 14px", display: "flex", flexDirection: "column", gap: 12 }}>
          {copy}
          {action}
        </div>
      )}
      {overlay && action ? <div style={{ padding: "12px var(--space-md) 14px" }}>{action}</div> : null}
    </div>
  );
}
