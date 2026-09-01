/**
 * The phone's palette, radii and type ramp (#46, following gather's ADR-0017).
 *
 * ADR-0017 says the phone owns its look and shares its words, and as of the
 * shell decision the phone exercises that: these colours come from
 * `designs/shell/index.html` (the "Coach" multi-sport direction), not from the
 * web's `src/styles.css`. The web is still Spotify-green on true black; the
 * phone is lime on a warmer near-black, with a semantic tint per activity type.
 * The two are meant to disagree until the web catches up — do not "fix" this
 * file by transcribing the web palette back over it.
 *
 * The mechanism never crossed anyway: CSS custom properties cascade, these do
 * not. Every value here is typed out, not imported.
 *
 * Dark-only, on purpose. There is no light palette on either side to port, and
 * inventing one is a bigger decision than any one ticket. `app.json` pins
 * `userInterfaceStyle: "dark"` so the keyboard and sheet grabbers match; the
 * day a light theme exists, `useTokens()` grows a `useColorScheme()` read and
 * every call site keeps working.
 */

/** Every colour the app is allowed to use. */
export const colors = {
	/** Page background. Near-black, warmed slightly off true black. */
	bg: "#0a0b09",
	/** Raised surface: cards, rows, sheets. */
	surface: "#141613",
	/** One step above `surface`: inputs, pressed states. */
	surface2: "#1d201b",

	/** The one accent. Everything interactive that matters is this lime. */
	accent: "#c8f73c",
	/** Accent under a finger. */
	accentPressed: "#d6ff5c",
	/** Accent at 13% — tinted backdrops behind accent content. */
	accentDim: "rgba(200, 247, 60, 0.13)",
	/** Ink on an accent-filled surface. Near-black, not white — the lime is bright. */
	onAccent: "#0a0b09",

	text: "#f2f4ef",
	textMuted: "#9ba095",
	textFaint: "#5c6156",

	border: "rgba(255, 255, 255, 0.07)",
	borderStrong: "rgba(255, 255, 255, 0.14)",

	danger: "#ff6b6b",
	dangerSoft: "rgba(255, 107, 107, 0.12)",
	success: "#4ade80",
	warn: "#fbbf24",
} as const;

/**
 * One entry per Activity type. A closed set of code literals per ADR-0004 —
 * not a user-extensible catalog, because each type needs its own detail schema
 * and logging UI that a data row cannot supply.
 *
 * ADR-0003 puts the canonical catalog in `packages/core` so Convex validators
 * and both clients share it. It lives here until that package grows an activity
 * module; `color`/`dim` would stay phone-side even then, since they are look
 * rather than words.
 */
export const sportMeta = {
	strength: {
		label: "Strength",
		glyph: "S",
		color: "#c8f73c",
		dim: "rgba(200, 247, 60, 0.14)",
		/** The only type with a real Convex-backed implementation today. */
		implemented: true,
	},
	running: {
		label: "Running",
		glyph: "R",
		color: "#ff8a4c",
		dim: "rgba(255, 138, 76, 0.14)",
		implemented: false,
	},
	cycling: {
		label: "Cycling",
		glyph: "C",
		color: "#4fd1e3",
		dim: "rgba(79, 209, 227, 0.14)",
		implemented: false,
	},
	wod: {
		label: "WOD",
		glyph: "W",
		color: "#ff5d73",
		dim: "rgba(255, 93, 115, 0.14)",
		implemented: false,
	},
} as const;

export type SportKey = keyof typeof sportMeta;

/**
 * Corner radii, transcribed from the web's `--r-*`. `pill` is the capsule used
 * by the primary action; `sheet` has no web counterpart because the web has no
 * bottom sheets.
 */
export const radius = {
	xs: 4,
	sm: 6,
	md: 8,
	lg: 12,
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
 * Named text styles. Screens pick a name; nothing outside this file sets a
 * `fontSize`. No custom fonts are bundled, so weights are numeric and the
 * platform synthesises them from the system face.
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
} as const;

/**
 * Colours, not conditions (gather's rule). Today this is a constant; it is a
 * hook so that adding a light scheme later is a change to this file and nothing
 * else. Call it in a component, never at module scope.
 */
export function useTokens() {
	return colors;
}

export type Tokens = typeof colors;
