/**
 * Hosted-workout join links: `https://foundry.appelent.nl/join/<token>`, the
 * same link in the app's own schemes (`foundry://join/<token>`), or a bare
 * join code.
 *
 * Case-sensitive, like the claimed `/join/*` path: a link that would not open
 * the app does not work when pasted either.
 *
 * Regular expressions rather than `URL`: React Native's `URL` polyfill does
 * not implement `pathname`, and `+native-intent` must never throw.
 */

/** The web host whose `/join/*` links the app claims (universal and app links). */
export const JOIN_LINK_HOST = "foundry.appelent.nl";

/** Join tokens are alphanumeric (`createJoinToken` in `convex/hostedWorkouts.ts`). */
const TOKEN = "[A-Za-z0-9]+";
const BARE_TOKEN = new RegExp(`^${TOKEN}$`);
const LINK = new RegExp(
	"^(?:" +
		// https://foundry.appelent.nl/join/<token>: exactly the claimed origin
		`https://${JOIN_LINK_HOST.replaceAll(".", "\\.")}/` +
		// foundry://join/<token>, foundry-preview://…, foundry-dev://…
		"|foundry(?:-preview|-dev)?:///?" +
		// /join/<token>, as Expo Router hands over an already parsed path
		"|/" +
		`)join/(${TOKEN})/?(?:[?#].*)?$`,
);

/** The token in a join link, or `null` when `url` is not one. */
export function joinTokenFromUrl(url: string): string | null {
	return LINK.exec(url.trim())?.[1] ?? null;
}

/** A bare join token, as the join route's `[token]` segment must be. */
export function isJoinToken(value: string): boolean {
	return BARE_TOKEN.test(value);
}

/**
 * The token of an app route path (`/join/<token>`), validating the whole
 * decoded segment: `usePathname()` decodes `%23` to `#`, which a link parser
 * would read as a fragment.
 */
export function joinTokenFromPathname(pathname: string): string | null {
	// No trailing slash: Expo Router never adds one, so `/join/ABC/` is the
	// decoded segment `ABC/` (from `ABC%2F`), not the token `ABC`.
	const segment = /^\/join\/([^/]*)$/.exec(pathname)?.[1] ?? "";
	return isJoinToken(segment) ? segment : null;
}

/** The join code typed or pasted into the Hosted screen: a bare token or a full link. */
export function parseJoinInput(input: string): string | null {
	const trimmed = input.trim();
	if (BARE_TOKEN.test(trimmed)) return trimmed;
	return joinTokenFromUrl(trimmed);
}

/** The app route a join link opens, or `null` when `url` is not one. */
export function joinRouteFromUrl(url: string): string | null {
	const token = joinTokenFromUrl(url);
	return token ? `/join/${token}` : null;
}
