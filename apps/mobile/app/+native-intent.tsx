/**
 * Rewrites incoming links before Expo Router matches them. A hosted-workout
 * join link (`https://foundry.appelent.nl/join/<token>`, or the app scheme)
 * opens the join route. Any other web link opens Coach: the app claims only
 * exact join links, and Expo Router would otherwise drop the origin and match
 * the path (a stray port or host would still reach `/join/<token>`). App
 * scheme links (sign-in callbacks, other routes) pass through unchanged.
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
	return /^https?:/i.test(path) ? "/" : path;
}
