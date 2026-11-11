/**
 * Whether this device has already offered the first-run to an account.
 * Offered, not completed: once shown it never returns on this device, whether
 * the person set goals, chose a workout, skipped, or swiped the sheet away. A
 * new device offers it again only while the account is still empty, and so
 * does this one after the account's data is reset here.
 */
import {
	accountKeyspace,
	readLocalJson,
	writeLocalJson,
} from "../../../local-store/local-store";

const offered = accountKeyspace("first-run-offered:v1");

/** An unreadable store counts as offered: better missed once than shown each launch. */
export function wasFirstRunOffered(userId: string) {
	const read = readLocalJson(offered.key(userId), () => true);
	return !read.ok || read.value !== null;
}

export function markFirstRunOffered(userId: string) {
	writeLocalJson(offered.key(userId), true);
}
