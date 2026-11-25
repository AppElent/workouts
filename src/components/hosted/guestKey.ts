const STORAGE_KEY = "foundry.hostedGuestKey";

let memoryKey: string | undefined;

function newKey() {
	return crypto.randomUUID().replaceAll("-", "");
}

/**
 * Forgets this browser's key, after Delete account: unclaimed guest scores
 * sent with it can no longer be corrected or claimed from here.
 */
export function forgetGuestKey() {
	memoryKey = undefined;
	try {
		window.localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Storage unavailable: nothing was stored.
	}
}

/**
 * A random key for this browser that guest scores are sent with, so a guest
 * can correct their own score and claim it after signing up, while another
 * guest with the same name keeps theirs. Falls back to a key for this page
 * load when storage is unavailable (private mode, blocked site data).
 */
export function getGuestKey() {
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (stored) return stored;
		const key = newKey();
		window.localStorage.setItem(STORAGE_KEY, key);
		return key;
	} catch {
		memoryKey ??= newKey();
		return memoryKey;
	}
}
