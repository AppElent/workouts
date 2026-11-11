/**
 * The phone's palette, radii, spacing and type ramp.
 *
 * These are the shipped values; the Foundry design kit in `designs/` is the
 * reference they were transcribed from. CSS custom properties cascade, these
 * do not, so every value is typed out.
 *
 * System / Light / Dark is resolved by AppearanceProvider. Static palettes are
 * used only for token definitions and UIKit trait-adaptive chrome. Components
 * read useTokens(). accentFill is the lime fill; accent and accentInk are
 * legible foreground colors in either scheme.
 */
import { type ColorValue, DynamicColorIOS, Platform } from "react-native";

import { darkColors, lightColors } from "./palette";

export { darkColors, lightColors, type Tokens } from "./palette";

/**
 * One entry per Activity type: a closed set of code literals (ADR-0001), not
 * a user-extensible catalog, because each type needs its own detail schema
 * and logging UI. The colours are presentation, so they stay phone-side.
 */
export const sportMeta = {
	strength: {
		glyph: "S",
		color: "#c8f73c",
		dim: "rgba(200, 247, 60, 0.14)",
	},
	running: {
		glyph: "R",
		color: "#ff8a4c",
		dim: "rgba(255, 138, 76, 0.14)",
	},
	cycling: {
		glyph: "C",
		color: "#4fd1e3",
		dim: "rgba(79, 209, 227, 0.14)",
	},
	wod: {
		glyph: "W",
		color: "#ff5d73",
		dim: "rgba(255, 93, 115, 0.14)",
	},
} as const;

export type SportKey = keyof typeof sportMeta;
type SportStyle = { glyph: string; color: string; dim: string };

/** The same sports, darkened to stay legible on the light scheme. */
export const lightSportMeta: Record<SportKey, SportStyle> = {
	strength: {
		...sportMeta.strength,
		color: "#466400",
		dim: "rgba(70, 100, 0, 0.10)",
	},
	running: {
		...sportMeta.running,
		color: "#9d430a",
		dim: "rgba(157, 67, 10, 0.10)",
	},
	cycling: {
		...sportMeta.cycling,
		color: "#086878",
		dim: "rgba(8, 104, 120, 0.10)",
	},
	wod: { ...sportMeta.wod, color: "#b42342", dim: "rgba(180, 35, 66, 0.10)" },
};

/**
 * Corner radii. Continuous ("squircle") on native via `borderCurve`. `pill` is
 * reserved for the primary action, chips, the resume bar and the rest timer —
 * not for every tappable thing. These apply to RN-drawn surfaces only; where
 * SwiftUI draws the surface the system's corners win.
 */
export const radius = {
	sm: 6,
	md: 8,
	lg: 12,
	/** Shell rows, tiles and the inset grouped list. */
	card: 14,
	/** Content cards. */
	cardLg: 18,
	/** Nutrition diary reference: composed content summary. */
	contentCard: 24,
	sheet: 20,
	pill: 9999,
} as const;

/**
 * 4-point grid. The web's Tailwind spacing is the same grid, so the two agree
 * without either importing the other.
 */
export const spacing = {
	xs: 4,
	sm: 8,
	md: 16,
	lg: 24,
	xl: 32,
	xxl: 48,
} as const;

/**
 * Layout decisions shared by screens and the form design-system seam. Heights
 * are minimums, never fixed, so Dynamic Type can grow a row.
 */
export const metrics = {
	screenGutter: 20,
	formGutter: 16,
	/** iOS grouped-list row; 44 is the floor. */
	rowMinHeight: 48,
	fieldMinHeight: 44,
	hitTarget: 44,
	sectionGap: 18,
	/** Hairlines start here from the leading edge, never full-bleed. */
	separatorInset: 16,
	/** A content column stops growing here so a tablet does not stretch a form. */
	formMaxWidth: 640,
} as const;

/** Text glyphs used as icons: `+`, `›`, `‹`, `−`. */
export const glyphSize = {
	sm: 18,
	md: 20,
	lg: 22,
	xl: 28,
} as const;

export const opacity = {
	/** Press is a colour change, not a fade; this is for the few places that must fade. */
	pressed: 0.7,
	disabled: 0.5,
} as const;

/**
 * Named text styles. Screens pick a name; nothing outside this file sets a
 * `fontSize`. No custom fonts are bundled, so weights are numeric and the
 * platform synthesises them from the system face.
 *
 * Two layers. The content ramp (`display` … `metric`) is the app's original.
 * The native layer (`largeTitle` … `control`) matches the platform's own text
 * styles; chrome and grouped lists use it so a screen reads as an app rather
 * than a page. Colours come from `useTokens()`.
 */
export const type = {
	quantityCompact: { fontSize: 44, fontWeight: "600", letterSpacing: -1.76 },
	table: { fontSize: 14, fontWeight: "400" },
	quantity: { fontSize: 52, fontWeight: "600", letterSpacing: -1.5 },
	display: { fontSize: 32, fontWeight: "800" },
	title: { fontSize: 24, fontWeight: "800" },
	heading: { fontSize: 18, fontWeight: "700" },
	body: { fontSize: 15, fontWeight: "500" },
	label: { fontSize: 13, fontWeight: "600" },
	caption: { fontSize: 12, fontWeight: "500" },
	/** Dense labels inside chips and plates; never body copy. */
	micro: { fontSize: 10, fontWeight: "700" },
	/** Numbers that are the point of the screen: reps, weight, set counts. */
	metric: { fontSize: 28, fontWeight: "800" },
	/** The value in a compact stat tile. */
	stat: { fontSize: 21, fontWeight: "800" },
	/** A small uppercase label over a group. */
	eyebrow: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	/** Chart axis ticks. */
	axis: { fontSize: 9, fontWeight: "400" },

	/** Native iOS layer. */
	largeTitle: {
		fontSize: 34,
		fontWeight: "700",
		letterSpacing: -0.8,
	},
	navTitle: { fontSize: 17, fontWeight: "600" },
	/** A grouped-list row title. */
	row: {
		fontSize: 17,
		fontWeight: "600",
		letterSpacing: -0.2,
	},
	/** The line under a row title, or a right-aligned value. */
	secondary: { fontSize: 15, fontWeight: "400" },
	/** Section footers, field errors, timestamps. */
	footnote: { fontSize: 13, fontWeight: "400" },
	/** Text inside a button or segmented control. */
	control: { fontSize: 16, fontWeight: "600" },
} as const;

/**
 * A colour that UIKit resolves itself, per trait, with no JS round-trip.
 * Android has no equivalent and follows `useTokens()` instead.
 */
function dynamic(dark: string, light: string): ColorValue {
	return Platform.OS === "ios" ? DynamicColorIOS({ dark, light }) : dark;
}

/**
 * Colours for native chrome — the tab bar, stack headers, large titles.
 *
 * On iOS 26 Liquid Glass decides the tab bar's trait on its own from the
 * content under it — even in a dev build with `userInterfaceStyle` baked into
 * Info.plist the bar comes up light for a moment. A static hex is therefore
 * wrong half the time (a lime icon on light glass). These resolve on the UIKit
 * side, so the bar is legible whichever way it flips, and they are the reason
 * `accentInk` has a light value at all. Stack headers do NOT use these: their
 * trait resolves light while the ground is dark, so they take the static
 * scheme colours (see `ui/coach-tab-stack.tsx`). Content never uses these
 * either; content reads `useTokens()`.
 */
export const chrome = {
	bg: dynamic(darkColors.bg, lightColors.bg),
	text: dynamic(darkColors.text, lightColors.text),
	textMuted: dynamic(darkColors.textMuted, lightColors.textMuted),
	accentInk: dynamic(darkColors.accentInk, lightColors.accentInk),
} as const;
