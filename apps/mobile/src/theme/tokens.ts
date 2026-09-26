/**
 * The phone's palette, radii, spacing and type ramp.
 *
 * The contract is `designs/foundry/` (readme + `tokens/*.css`); this file is
 * its React Native transcription. CSS custom properties cascade, these do not,
 * so every value is typed out. When the two disagree, Foundry wins — fix this
 * file, not the design system. The web app adopts the same palette
 * (`docs/design/foundry-native-plan.md`), so there is no longer a "web look"
 * to keep this one apart from.
 *
 * System / Light / Dark is resolved by AppearanceProvider. Static palettes are
 * used only for token definitions and UIKit trait-adaptive chrome. Components
 * read useTokens(). accentFill is the lime fill; accent and accentInk are
 * legible foreground colors in either scheme.
 */
import { type ColorValue, DynamicColorIOS, Platform } from "react-native";

/** Every colour the app is allowed to use, dark scheme. */
export const darkColors = {
	bg: "#0a0b09",
	surface: "#141613",
	surface2: "#1d201b",
	accent: "#c8f73c",
	accentPressed: "#d6ff5c",
	accentDim: "rgba(200, 247, 60, 0.13)",
	onAccent: "#0a0b09",
	accentInk: "#c8f73c",
	text: "#f2f4ef",
	textMuted: "#9ba095",
	textFaint: "#919789",
	border: "rgba(255, 255, 255, 0.07)",
	borderStrong: "rgba(255, 255, 255, 0.14)",
	separator: "rgba(255, 255, 255, 0.14)",
	danger: "#ff6b6b",
	dangerSoft: "rgba(255, 107, 107, 0.12)",
	success: "#4ade80",
	successSoft: "rgba(74, 222, 128, 0.10)",
	warn: "#fbbf24",
	warnSoft: "rgba(251, 191, 36, 0.12)",
	warnBorder: "rgba(251, 191, 36, 0.25)",
	accentFill: "#c8f73c",
	onDanger: "#0a0b09",
	scrim: "rgba(0, 0, 0, 0.6)",
	mediaScrim: "rgba(10, 11, 9, 0.72)",
	onMedia: "#ffffff",
	surfaceTransparent: "rgba(20, 22, 19, 0)",
} as const;

export const colors = darkColors;

/** The light scheme — `designs/foundry/tokens/light.css`. Same keys, so a screen never branches. */
export const lightColors: Tokens = {
	bg: "#f4f5f0",
	surface: "#ffffff",
	surface2: "#e9ece3",
	accent: "#466400",
	accentPressed: "#b5e329",
	accentDim: "rgba(70, 100, 0, 0.10)",
	onAccent: "#0a0b09",
	accentInk: "#466400",
	text: "#1a2015",
	textMuted: "#535e49",
	textFaint: "#606b57",
	border: "rgba(26, 32, 21, 0.12)",
	borderStrong: "rgba(26, 32, 21, 0.25)",
	separator: "rgba(60, 62, 50, 0.10)",
	danger: "#b42332",
	dangerSoft: "rgba(180, 35, 50, 0.09)",
	success: "#24723c",
	successSoft: "rgba(21, 127, 69, 0.10)",
	warn: "#865500",
	warnSoft: "rgba(134, 85, 0, 0.09)",
	warnBorder: "rgba(134, 85, 0, 0.25)",
	accentFill: "#c8f73c",
	onDanger: "#ffffff",
	scrim: "rgba(0, 0, 0, 0.4)",
	mediaScrim: "rgba(10, 11, 9, 0.72)",
	onMedia: "#ffffff",
	surfaceTransparent: "rgba(255, 255, 255, 0)",
};

export const colorsLight = lightColors;

/**
 * One entry per proposed Activity type. A closed set of code literals per
 * ADR-0001 —
 * not a user-extensible catalog, because each type needs its own detail schema
 * and logging UI that a data row cannot supply.
 *
 * Presentation metadata remains phone-local. A
 * future shared catalog belongs to the Activity migration; the colours stay
 * phone-side because they are presentation rather than domain language.
 * `colorLight`/`dimLight` are the darkened hues that stay legible as a label
 * on their own tint against white.
 */
export const sportMeta = {
	strength: {
		label: "Strength",
		glyph: "S",
		color: "#c8f73c",
		dim: "rgba(200, 247, 60, 0.14)",
		colorLight: "#5f7a10",
		dimLight: "rgba(200, 247, 60, 0.30)",
		/** Strength retains its existing session storage. */
		implemented: true,
	},
	running: {
		label: "Running",
		glyph: "R",
		color: "#ff8a4c",
		dim: "rgba(255, 138, 76, 0.14)",
		colorLight: "#c2540f",
		dimLight: "rgba(255, 138, 76, 0.20)",
		implemented: true,
	},
	cycling: {
		label: "Cycling",
		glyph: "C",
		color: "#4fd1e3",
		dim: "rgba(79, 209, 227, 0.14)",
		colorLight: "#0d7e8c",
		dimLight: "rgba(79, 209, 227, 0.20)",
		implemented: true,
	},
	wod: {
		label: "WOD",
		glyph: "W",
		color: "#ff5d73",
		dim: "rgba(255, 93, 115, 0.14)",
		colorLight: "#c22b43",
		dimLight: "rgba(255, 93, 115, 0.18)",
		implemented: false,
	},
} as const;

export type SportKey = keyof typeof sportMeta;

export const lightSportMeta = {
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
	xs: 4,
	sm: 6,
	md: 8,
	lg: 12,
	/** Shell rows, tiles and the inset grouped list. */
	card: 14,
	/** Content cards. */
	cardLg: 18,
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
	/** The primary capsule. */
	controlHeight: 46,
	sectionGap: 18,
	/** Hairlines start here from the leading edge, never full-bleed. */
	separatorInset: 16,
	/** A content column stops growing here so a tablet does not stretch a form. */
	formMaxWidth: 640,
} as const;

/**
 * Motion is native where possible. In-app motion is short, eased and never
 * looping — skeletons are still, so Reduce Motion needs no branch.
 */
export const motion = {
	/** cubic-bezier(0.32, 0.72, 0, 1) — the spring that settles a swiped row. */
	easeIos: [0.32, 0.72, 0, 1] as const,
	durFast: 150,
	durBase: 250,
	durSheet: 350,
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
 * than a page. Colours here are the dark scheme — a migrated screen overrides
 * `color` from `useTokens()`.
 */
export const type = {
	display: { fontSize: 32, fontWeight: "800" },
	title: { fontSize: 24, fontWeight: "800" },
	heading: { fontSize: 18, fontWeight: "700" },
	body: { fontSize: 15, fontWeight: "500" },
	label: { fontSize: 13, fontWeight: "600" },
	caption: { fontSize: 12, fontWeight: "500" },
	/** Numbers that are the point of the screen: reps, weight, set counts. */
	metric: { fontSize: 28, fontWeight: "800" },

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
 * scheme colours (see `coach-tab-stack.tsx`). Content never uses these
 * either; content reads `useTokens()`.
 */
export const chrome = {
	bg: dynamic(colors.bg, colorsLight.bg),
	text: dynamic(colors.text, colorsLight.text),
	textMuted: dynamic(colors.textMuted, colorsLight.textMuted),
	accentInk: dynamic(colors.accentInk, colorsLight.accentInk),
} as const;

export type Scheme = "dark" | "light";
export type Tokens = { readonly [K in keyof typeof darkColors]: string };
