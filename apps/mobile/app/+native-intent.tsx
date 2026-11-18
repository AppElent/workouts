/**
 * Rewrites incoming links before Expo Router matches them. A hosted-workout
 * join link (`https://foundry.appelent.nl/join/<token>`, or the app scheme)
 * opens the join route; every other link passes through unchanged.
 */
import { joinRouteFromUrl } from "../src/features/training/hosted/join-link";

export function redirectSystemPath({
	path,
}: {
	path: string;
	initial: boolean;
}): string {
	return joinRouteFromUrl(path) ?? path;
}
