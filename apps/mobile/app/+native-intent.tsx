/**
 * Rewrites incoming links before Expo Router matches them. A hosted-workout
 * join link (`https://foundry.appelent.nl/join/<token>`, or the app scheme)
 * opens the join route. Any other web link opens Coach: the app claims only
 * exact join links, and Expo Router would otherwise drop the origin and match
 * the path (a stray port or host would still reach `/join/<token>`). A
 * malformed join link opens Coach too. Other app-scheme links (sign-in
 * callbacks, other routes) pass through unchanged.
 */
import { joinRouteFromUrl } from "../src/features/training/hosted/join-link";

export function redirectSystemPath({
	path,
}: {
	path: string;
	initial: boolean;
}): string {
	const join = joinRouteFromUrl(path);
	if (join) return join;
	if (/^https?:/i.test(path)) return "/";
	// A malformed app-scheme join link (`foundry://join//ABC`) must not reach
	// Expo Router, which would collapse the slashes and match `/join/ABC`.
	if (/^(?:[a-z][a-z0-9+.-]*:)?\/*join(?:[/?#]|$)/i.test(path)) return "/";
	return path;
}
