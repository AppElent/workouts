// Locale-neutral formatters. Anything with words or decimal separators is
// rendered by the apps from the numbers these helpers work with.

const pad = (value: number) => String(value).padStart(2, "0");

/** "0:42", "12:30", and "1:02:47" from an hour. Partial seconds are dropped. */
export function formatClock(totalSeconds: number): string {
	const safe = Number.isFinite(totalSeconds)
		? Math.max(0, Math.floor(totalSeconds))
		: 0;
	const hours = Math.floor(safe / 3600);
	const minutes = Math.floor((safe % 3600) / 60);
	const seconds = safe % 60;
	return hours > 0
		? `${hours}:${pad(minutes)}:${pad(seconds)}`
		: `${minutes}:${pad(seconds)}`;
}

/**
 * Hours and minutes of a finished session, rounded to the minute. A session
 * that ended counts at least one minute, so it never reads as "0m".
 */
function durationParts(durationMs: number): {
	hours: number;
	minutes: number;
} {
	const total = Math.max(1, Math.round(Math.max(0, durationMs) / 60_000));
	return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** "48m", "1h", "1h 12m". */
export function formatDurationMinutes(durationMs: number): string {
	const { hours, minutes } = durationParts(durationMs);
	if (hours === 0) return `${minutes}m`;
	return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

/** "4:05 /km" for a pace in seconds per kilometre; null when there is none. */
export function formatPace(secondsPerKilometer: number | null): string | null {
	if (secondsPerKilometer === null || !Number.isFinite(secondsPerKilometer))
		return null;
	const rounded = Math.round(secondsPerKilometer);
	return `${Math.floor(rounded / 60)}:${pad(rounded % 60)} /km`;
}
