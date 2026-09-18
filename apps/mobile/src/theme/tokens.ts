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
 * Two schemes. Dark is the base; light is Foundry's addition. `app.json` still
 * pins `userInterfaceStyle: "dark"` — the light ramp is data until each screen
 * reads `useTokens()` instead of the static `colors` object and passes device
 * QA. `colors` stays exported for the screens that have not migrated.
 *
 * The one rule light mode turns on: lime on white is ~1.4:1, so `accent` is a
 * FILL and never ink. Text, icons, strokes and chart series read `accentInk`
 * unconditionally — it is the same lime in dark and a deep olive in light.
 */
import { useColorScheme } from "react-native";

/** Every colour the app is allowed to use, dark scheme. */
export const colors = {
	/** Page background. Near-black, warmed slightly off true black. */
	bg: "#0a0b09",
	/** Raised surface: cards, rows, sheets. */
	surface: "#141613",
	/** One step above `surface`: inputs, pressed states. */
	surface2: "#1d201b",

	/** The one accent, as a fill. Everything interactive that matters is this lime. */
	accent: "#c8f73c",
	/** Accent under a finger. */
	accentPressed: "#d6ff5c",
	/** Accent at 13% — tinted backdrops behind accent content. */
	accentDim: "rgba(200, 247, 60, 0.13)",
	/** Ink on an accent-filled surface. Near-black, not white — the lime is bright. */
	onAccent: "#0a0b09",
	/** Accented text, icons, strokes and chart series. Never `accent` for these. */
	accentInk: "#c8f73c",

	text: "#f2f4ef",
	textMuted: "#9ba095",
	textFaint: "#5c6156",

	border: "rgba(255, 255, 255, 0.07)",
	borderStrong: "rgba(255, 255, 255, 0.14)",
	/** The 0.5pt hairline between rows of a group, inset from the leading edge. */
	separator: "rgba(255, 255, 255, 0.14)",

	danger: "#ff6b6b",
	dangerSoft: "rgba(255, 107, 107, 0.12)",
	success: "#4ade80",
	successSoft: "rgba(74, 222, 128, 0.10)",
	warn: "#fbbf24",
	warnSoft: "rgba(251, 191, 36, 0.12)",
	warnBorder: "rgba(251, 191, 36, 0.25)",
} as const;

/** The light scheme — `designs/foundry/tokens/light.css`. Same keys, so a screen never branches. */
export const colorsLight: Tokens = {
	bg: "#faf9f5",
	surface: "#ffffff",
	surface2: "#f3f2ec",

	accent: "#c8f73c",
	accentPressed: "#d6ff5c",
	accentDim: "rgba(200, 247, 60, 0.22)",
	onAccent: "#1b1d18",
	/** Deep olive — 5.6:1 on white. */
	accentInk: "#55700c",

	text: "#1b1d18",
	textMuted: "#6b6f62",
	textFaint: "#9a9d90",

	border: "rgba(60, 62, 50, 0.13)",
	borderStrong: "rgba(60, 62, 50, 0.22)",
	separator: "rgba(60, 62, 50, 0.10)",

	danger: "#c0302c",
	dangerSoft: "rgba(192, 48, 44, 0.09)",
	success: "#157f45",
	successSoft: "rgba(21, 127, 69, 0.10)",
	warn: "#9a6600",
	warnSoft: "rgba(154, 102, 0, 0.10)",
	warnBorder: "rgba(154, 102, 0, 0.25)",
};

/**
 * One entry per proposed Activity type. A closed set of code literals per
 * ADR-0001 —
 * not a user-extensible catalog, because each type needs its own detail schema
 * and logging UI that a data row cannot supply.
 *
 * This remains phone-local while Strength is the only implemented type. A
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
		/** The only type with a real Convex-backed implementation today. */
		implemented: true,
	},
	running: {
		label: "Running",
		glyph: "R",
		color: "#ff8a4c",
		dim: "rgba(255, 138, 76, 0.14)",
		colorLight: "#c2540f",
		dimLight: "rgba(255, 138, 76, 0.20)",
		implemented: false,
	},
	cycling: {
		label: "Cycling",
		glyph: "C",
		color: "#4fd1e3",
		dim: "rgba(79, 209, 227, 0.14)",
		colorLight: "#0d7e8c",
		dimLight: "rgba(79, 209, 227, 0.20)",
		implemented: false,
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
	display: { fontSize: 32, fontWeight: "800", color: colors.text },
	title: { fontSize: 24, fontWeight: "800", color: colors.text },
	heading: { fontSize: 18, fontWeight: "700", color: colors.text },
	body: { fontSize: 15, fontWeight: "500", color: colors.text },
	label: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
	caption: { fontSize: 12, fontWeight: "500", color: colors.textMuted },
	/** Numbers that are the point of the screen: reps, weight, set counts. */
	metric: { fontSize: 28, fontWeight: "800", color: colors.text },

	/** Native iOS layer. */
	largeTitle: {
		fontSize: 34,
		fontWeight: "700",
		letterSpacing: -0.8,
		color: colors.text,
	},
	navTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
	/** A grouped-list row title. */
	row: {
		fontSize: 17,
		fontWeight: "600",
		letterSpacing: -0.2,
		color: colors.text,
	},
	/** The line under a row title, or a right-aligned value. */
	secondary: { fontSize: 15, fontWeight: "400", color: colors.textMuted },
	/** Section footers, field errors, timestamps. */
	footnote: { fontSize: 13, fontWeight: "400", color: colors.textMuted },
	/** Text inside a button or segmented control. */
	control: { fontSize: 16, fontWeight: "600", color: colors.text },
} as const;

/**
 * Colours, not conditions (gather's rule). Follows the OS scheme; while
 * `app.json` pins dark this always returns `colors`. Call it in a component,
 * never at module scope — a `StyleSheet.create` that captures it is dark
 * forever.
 */
export function useTokens(): Tokens {
	return useColorScheme() === "light" ? colorsLight : colors;
}

export type Tokens = { readonly [K in keyof typeof colors]: string };
