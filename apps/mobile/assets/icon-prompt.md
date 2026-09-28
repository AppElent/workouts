# Foundry app icon

Generated with the built-in image generation tool using the
[app-icon skill](https://github.com/Melvynx/aiblueprint/blob/main/agents-config/skills/app-icon/SKILL.md).

The glossy lime anvil represents building strength. The charcoal background
and lime hero follow Foundry's brand palette. No text or corner mask is baked in.

- `icon.png`: 1024 × 1024, opaque iOS and general Expo icon.
- `adaptive-icon.png`: 1024 × 1024, with the subject inside the Android safe zone.
- `favicon.png`: 192 × 192, Expo web favicon.

Assets were resized with macOS `sips`. Native icon changes require a rebuild;
an OTA update cannot change the launcher icon.

The Android variant was first scaled to 66% and padded. A built-in image edit
then made the background seamless while preserving the smaller anvil:

> Preserve the exact glossy lime anvil, its details, geometry, lighting and
> position, including its current size (about 56% of the canvas width). Replace
> the rectangular olive background patch and black outer padding with one
> seamless dark charcoal olive background across the full canvas. No detectable
> square edge, smaller tile or rounded corners. Preserve generous padding; the
> entire silhouette must fit inside the central circle of diameter 66% of the
> canvas. No text, other objects or transparency.

## Generation prompt

Create a 1024x1024 square app icon — premium, vibrant and dimensional, in the style of top App Store featured apps.
Subject: one bold sculptural anvil for Foundry, a strength-training and nutrition app about building yourself. A single instantly recognizable compact anvil with a broad flat top, one tapered horn pointing left, a short squared heel on the right, a pinched waist, and a stable wide foot. No hammer, no separate objects. Friendly substantial rounded bevels, strong athletic character; no face.
The look (north star): one dimensional hero rendered in soft glossy 3D — smooth color gradients, soft studio lighting, gentle rim light and a subtle soft glow, rounded volumes and real depth — centered on a FULL-BLEED vivid branded background that reaches all four edges. Saturated, high-contrast, polished. Like a polished cast-resin sculpture with tasteful highlights.
Background: fill the ENTIRE square edge-to-edge with a uniform near-black charcoal with a very subtle deep olive cast. No floor horizon. Never plain white, never empty. The background is part of the icon.
Subject treatment: dimensional and glossy — smooth rounded 3D forms, gentle highlights, a subtle inner glow, clear depth and volume. Rich saturated electric lime and yellow-green highlights, deeper olive-lime sides. Slight three-quarter view, chiefly front-on to preserve the anvil's unmistakable silhouette. Clean surfaces without ornament or fine details.
Composition: the hero centered, filling approximately 62% of the canvas width and 52% of its height; all critical subject details inside the central 66% circle for adaptive masking. Comfortable breathing room; background fills to edges. One focal point, no clutter.
If the brand is monochrome (one ink + one accent), STILL make it fully dimensional and premium — glossy 3D form, tonal gradients within the brand color, soft lighting, a bold full-bleed background. Never a flat single-color glyph.
Do NOT: flat monochrome pictogram, black-on-white glyph, single-color line/silhouette icon, plain SVG/vector symbol, sticker or clip-art; plain white or empty background; a smaller rounded card/icon floating inside the canvas (no icon-in-icon, no outer margins); baked rounded app-icon corners or device-rounded corners (keep a full square with sharp 90 degree corners — iOS applies its own mask); any text, letters, numbers, monograms or watermark; realistic human faces or photos as the main subject; real or trademarked brand logos; mirror chrome, garish neon bloom or lens flares.
Color palette: electric lime and yellow-green glossy anvil on near-black charcoal with deep olive undertones. High saturation, strong contrast on the home screen.
Technical: square 1:1; background bleeds to all four edges with sharp corners, no transparency; punchy and readable at 60px (blur test).
