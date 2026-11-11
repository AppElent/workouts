/**
 * Which accounts this device has already offered the first-run. Offered, not
 * completed: once shown it never returns on this device, whether the person
 * set goals, chose a workout, skipped, or swiped the sheet away. A new device
 * offers it again only while the account is still empty.
 */
import {
	PREFERENCE_KEYS,
	readPreference,
	writePreference,
} from "../../../prefs/local-preference";

function offeredAccounts(): string[] {
	const stored = readPreference(PREFERENCE_KEYS.firstRunOffered);
	if (!stored) return [];
	try {
		const parsed: unknown = JSON.parse(stored);
		return Array.isArray(parsed)
			? parsed.filter((id): id is string => typeof id === "string")
			: [];
	} catch {
		return [];
	}
}

export function wasFirstRunOffered(userId: string) {
	return offeredAccounts().includes(userId);
}

export function markFirstRunOffered(userId: string) {
	const accounts = offeredAccounts();
	if (accounts.includes(userId)) return;
	writePreference(
		PREFERENCE_KEYS.firstRunOffered,
		JSON.stringify([...accounts, userId]),
	);
}
