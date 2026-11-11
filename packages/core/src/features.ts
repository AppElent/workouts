// Foundry's platform feature list (platform-parity standard, decided in
// docs/adr/0017-mobile-leads-web-shares.md). Pure data: no imports, so it runs
// on web, Worker, Convex, and Hermes. scripts/feature-manifest.test.ts fails
// when a web or mobile route is missing here or a pattern matches no route.

export type Platform = "web" | "mobile";

/**
 * parity: on both platforms. exclusive: on one platform by design.
 * pending-port: meant for both platforms, on one for now.
 */
export type FeatureStatus = "parity" | "exclusive" | "pending-port";

/**
 * floor: required on both platforms (sign-in, account, export, deletion, ...).
 * share-target: someone without the app may open it from a link.
 * product: everything else.
 */
export type FeatureKind = "floor" | "share-target" | "product";

export interface Feature {
	/** Stable kebab-case id. */
	readonly id: string;
	readonly kind: FeatureKind;
	readonly status: FeatureStatus;
	/** Platforms that ship the feature today. */
	readonly platforms: readonly Platform[];
	/** Why the feature is not on both platforms. Required unless status is "parity". */
	readonly reason?: string;
	/** Web layout. Defaults to "responsive"; "large-screen" needs layoutReason. */
	readonly layout?: "responsive" | "large-screen";
	readonly layoutReason?: string;
	/**
	 * Route files owned by the feature, relative to each platform's route root
	 * and without extension. `*` matches within one path segment, `**` across
	 * segments: "recipes/**", "(app)/(tabs)/settings/*".
	 */
	readonly routes: {
		readonly web?: readonly string[];
		readonly mobile?: readonly string[];
	};
}

export const defineFeatures = <const T extends readonly Feature[]>(
	features: T,
): T => features;

const ADR = "docs/adr/0017-mobile-leads-web-shares.md";

export const FEATURES = defineFeatures([
	// Floor: required on both platforms (docs/adr/0017-mobile-leads-web-shares.md).
	{
		id: "sign-in",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {
			web: ["sign-in", "sign-up", "sso-callback"],
			mobile: ["(auth)/**"],
		},
	},
	{
		id: "password-reset",
		kind: "floor",
		status: "pending-port",
		platforms: ["web"],
		reason: "Mobile sign-in has no forgot-password flow (#201).",
		routes: { web: ["forgot-password"] },
	},
	{
		id: "password-change",
		kind: "floor",
		status: "pending-port",
		platforms: ["web"],
		reason: "Only the web Account page can change a password (#201).",
		routes: {},
	},
	{
		id: "account-profile",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {
			web: ["_app/_authed/account/index"],
			mobile: ["(app)/(coach)/profile/index", "(app)/account"],
		},
	},
	{
		id: "account-deletion",
		kind: "floor",
		status: "pending-port",
		platforms: ["mobile"],
		reason:
			"Only the mobile Account screen deletes data or the account (#200).",
		routes: {},
	},
	{
		// Both platforms export every personal table through exportData.personalPage.
		id: "data-export",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {},
	},
	{
		id: "language",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: { mobile: ["(app)/language"] },
	},
	{
		id: "theme",
		kind: "floor",
		status: "pending-port",
		platforms: ["mobile"],
		reason: "The web has one dark theme and no theme choice (#205).",
		routes: { mobile: ["(app)/appearance"] },
	},
	{
		// Mobile opens the web privacy page from the Account screen.
		id: "privacy",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: { web: ["privacy"] },
	},

	// Share target: the hosted-workout join link must work in a phone browser.
	{
		id: "hosted-workout-join",
		kind: "share-target",
		status: "pending-port",
		platforms: ["web"],
		reason:
			"The app cannot open /join/<token> links: no join route, and the Hosted code box takes a bare token only (#202). Web gaps: token lost through sign-in (#203), same-name guests overwrite scores (#204).",
		routes: { web: ["_app/join/$token"] },
	},

	// Product: shared training screens.
	{
		id: "dashboard",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {
			web: ["_app/_authed/dashboard/index"],
			mobile: ["(app)/(coach)/(home)/index"],
		},
	},
	{
		id: "strength-sessions",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {
			web: ["_app/_authed/log/*"],
			mobile: [
				"(app)/(coach)/train/index",
				"(app)/start-activity/index",
				"(app)/session",
				"(app)/session-group",
				"(app)/session-manual",
				"(app)/set-editor/*",
				"(app)/summary",
				"(app)/activity-history",
			],
		},
	},
	{
		id: "routines",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {
			web: ["_app/_authed/routines/index"],
			mobile: ["(app)/routine-editor"],
		},
	},
	{
		// Editing and deleting WODs and WOD Results is mobile-only; the web creates and logs.
		id: "wods",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {
			web: ["_app/_authed/wods/*"],
			mobile: [
				"(app)/wods",
				"(app)/wod/*",
				"(app)/wod-editor",
				"(app)/start-activity/wods",
				"(app)/start-activity/wod/*",
				"(app)/start-activity/wod-editor",
			],
		},
	},
	{
		// Editing an exercise is mobile-only; the web creates and removes.
		id: "exercises",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {
			web: ["_app/exercises/*"],
			mobile: ["(app)/exercises", "(app)/exercise/*", "(app)/exercise-new"],
		},
	},
	{
		// Body metrics live on both progress screens.
		id: "progress",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {
			web: ["_app/_authed/progress/index"],
			mobile: ["(app)/(coach)/progress/index"],
		},
	},
	{
		// Run the hosted workout: open, close, leaderboard, delete.
		id: "hosted-workout-hosting",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {
			web: [
				"_app/_authed/hosted-workouts/index",
				"_app/_authed/hosted-workouts/$id",
			],
			mobile: ["(app)/hosted", "(app)/hosted/*"],
		},
	},

	// Product: web by design.
	{
		id: "hosted-workout-authoring",
		kind: "product",
		status: "exclusive",
		platforms: ["web"],
		reason: `Sharing goal: every WOD needs four scaling levels, which is desk work before a class (${ADR}).`,
		routes: {
			web: [
				"_app/_authed/hosted-workouts/new",
				"_app/_authed/hosted-workouts/edit.$id",
			],
		},
	},
	{
		id: "mcp",
		kind: "product",
		status: "exclusive",
		platforms: ["web"],
		reason: `Integration goal: the MCP server and its OAuth discovery live on the web origin (${ADR}).`,
		routes: { web: ["mcp", "[.]well-known/$"] },
	},
	{
		id: "landing",
		kind: "product",
		status: "exclusive",
		platforms: ["web"],
		reason: `The public entry for visitors and shared links; the app opens on the signed-in home (${ADR}).`,
		routes: { web: ["index"] },
	},

	// Product: mobile by design (phone goal).
	{
		id: "nutrition",
		kind: "product",
		status: "exclusive",
		platforms: ["mobile"],
		reason: `Phone goal: the Diary, Goals, food library, Combos, photos and AI assistance are logged where you eat (${ADR}).`,
		routes: {
			mobile: [
				"(app)/(coach)/nutrition/index",
				"(app)/nutrition-*",
				"(app)/nutrition-combo/*",
				"(app)/personal-food-new",
				"(app)/personal-food/*",
			],
		},
	},
	{
		id: "personal-measures",
		kind: "product",
		status: "exclusive",
		platforms: ["mobile"],
		reason: `Phone goal: Personal Measures serve nutrition logging on the phone (${ADR}).`,
		routes: { mobile: ["(app)/personal-measures"] },
	},
	{
		id: "endurance",
		kind: "product",
		status: "exclusive",
		platforms: ["mobile"],
		reason: `Phone goal: runs and rides are logged and edited where you train (${ADR}).`,
		routes: {
			mobile: [
				"(app)/start-activity/endurance",
				"(app)/endurance-editor",
				"(app)/endurance/*",
			],
		},
	},
	{
		id: "first-run",
		kind: "product",
		status: "exclusive",
		platforms: ["mobile"],
		reason: `Phone goal: first-run setup prepares an empty account for training on the phone (${ADR}).`,
		routes: { mobile: ["(app)/first-run"] },
	},
	{
		id: "local-database",
		kind: "product",
		status: "exclusive",
		platforms: ["mobile"],
		reason: `Phone goal: inspects and clears the app's on-device caches (${ADR}).`,
		routes: { mobile: ["(app)/local-database"] },
	},
]);
