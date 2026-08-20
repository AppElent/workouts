/**
 * The phone's palette, radii and type ramp (#46, following gather's ADR-0017).
 *
 * ADR-0017 says the phone owns its look and shares its words. Here the phone
 * chooses to look *exactly* like the web, and that is a decision rather than a
 * default: the web palette in `src/styles.css` is 12 hex literals and a handful
 * of `rgba()` values — both formats React Native's colour parser accepts — so
 * agreeing with the web costs nothing. (The research inventory on #42 claimed
 * these tokens were `oklch()` and unportable; they are not. See the correction
 * on that issue.)
 *
 * What does *not* cross is the mechanism: CSS custom properties cascade, these
 * do not. Every value here is transcribed, not imported, and the two will drift
 * unless someone keeps them honest. That is the accepted cost of one accent
 * colour in two runtimes — a shared package for six hex strings would be worse.
 *
 * Dark-only, on purpose. The web app has no light palette to port: `:root` is
 * the Spotify-dark set and there is no `.light` block behind it. Inventing a
 * light scheme for the phone would mean designing a palette the web has never
 * had, which is a bigger decision than this ticket. `app.json` therefore pins
 * `userInterfaceStyle: "dark"` so the keyboard and sheet grabbers match; the
 * day a light theme exists, `useTokens()` grows a `useColorScheme()` read and
 * every call site keeps working.
 */

/** Every colour the app is allowed to use. */
export const colors = {
	/** Page background. True black, as on the web. */
	bg: "#000000",
	/** Raised surface: cards, rows, sheets. */
	surface: "#1a1a1a",
	/** One step above `surface`: inputs, pressed states. */
	surface2: "#242424",

	/** The one accent. Everything interactive that matters is this green. */
	accent: "#1db954",
	/** Accent under a finger. */
	accentPressed: "#1ed760",
	/** Accent at 8% — tinted backdrops behind accent content. */
	accentDim: "rgba(29, 185, 84, 0.08)",
	/** Ink on an accent-filled surface. Black, not white — the green is bright. */
	onAccent: "#000000",

	text: "#ffffff",
	textMuted: "#b3b3b3",
	textFaint: "rgba(255, 255, 255, 0.5)",

	border: "rgba(255, 255, 255, 0.1)",
	borderStrong: "rgba(255, 255, 255, 0.18)",

	danger: "#f87171",
	dangerSoft: "rgba(248, 113, 113, 0.12)",
	success: "#4ade80",
	warn: "#fbbf24",
} as const;

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
