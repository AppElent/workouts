import { type RuleResult, ruleIssues } from "./rules";

export const ENDURANCE_SPORTS = ["running", "cycling"] as const;
export type EnduranceSport = (typeof ENDURANCE_SPORTS)[number];
export const ACTIVITY_SPORTS = ["strength", ...ENDURANCE_SPORTS] as const;
export type ActivitySport = (typeof ACTIVITY_SPORTS)[number];
export const ENDURANCE_ENVIRONMENTS = ["indoor", "outdoor"] as const;
export type EnduranceEnvironment = (typeof ENDURANCE_ENVIRONMENTS)[number];

export type ActivitySummary = {
	id: string;
	sport: ActivitySport;
	occurredAt: number;
	durationSeconds: number;
	title?: string;
	distanceMeters?: number;
};

type EnduranceInput = {
	occurredAt: number;
	durationSeconds: number;
	distanceMeters: number;
	title?: string | null;
	notes?: string | null;
	environment?: EnduranceEnvironment | null;
	elevationGainMeters?: number | null;
	averageHeartRate?: number | null;
	effort?: number | null;
};

/** Server limits for a logged endurance activity. */
export const ENDURANCE_LIMITS = {
	effort: { min: 1, max: 10 },
	titleLength: 200,
	notesLength: 10_000,
} as const;

export type EnduranceField =
	| "occurredAt"
	| "durationSeconds"
	| "distanceMeters"
	| "elevationGainMeters"
	| "averageHeartRate"
	| "effort"
	| "title"
	| "notes";
type EnduranceCode =
	| "invalid"
	| "future"
	| "notPositive"
	| "negative"
	| "notWhole"
	| "outOfRange"
	| "tooLong";

export function validateEnduranceInput<T extends EnduranceInput>(
	input: T,
	now = Date.now(),
): RuleResult<T, EnduranceField, EnduranceCode> {
	const found = ruleIssues<EnduranceField, EnduranceCode>();
	if (!Number.isSafeInteger(input.occurredAt) || input.occurredAt < 0)
		found.add("occurredAt", "invalid");
	else if (input.occurredAt > now) found.add("occurredAt", "future");
	if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0)
		found.add("durationSeconds", "notPositive");
	if (!Number.isFinite(input.distanceMeters) || input.distanceMeters <= 0)
		found.add("distanceMeters", "notPositive");
	if (
		input.elevationGainMeters != null &&
		(!Number.isFinite(input.elevationGainMeters) ||
			input.elevationGainMeters < 0)
	)
		found.add("elevationGainMeters", "negative");
	if (input.averageHeartRate != null) {
		if (!Number.isSafeInteger(input.averageHeartRate))
			found.add("averageHeartRate", "notWhole");
		else if (input.averageHeartRate <= 0)
			found.add("averageHeartRate", "notPositive");
	}
	if (
		input.effort != null &&
		(!Number.isSafeInteger(input.effort) ||
			input.effort < ENDURANCE_LIMITS.effort.min ||
			input.effort > ENDURANCE_LIMITS.effort.max)
	)
		found.add("effort", "outOfRange");
	if (input.title != null && input.title.length > ENDURANCE_LIMITS.titleLength)
		found.add("title", "tooLong");
	if (input.notes != null && input.notes.length > ENDURANCE_LIMITS.notesLength)
		found.add("notes", "tooLong");
	return found.result(input);
}

export function paceSecondsPerKilometer(
	distanceMeters: number,
	durationSeconds: number,
): number | null {
	if (
		!Number.isFinite(distanceMeters) ||
		!Number.isFinite(durationSeconds) ||
		distanceMeters <= 0 ||
		durationSeconds <= 0
	)
		return null;
	return (durationSeconds * 1000) / distanceMeters;
}

export function speedKilometersPerHour(
	distanceMeters: number,
	durationSeconds: number,
): number | null {
	if (
		!Number.isFinite(distanceMeters) ||
		!Number.isFinite(durationSeconds) ||
		distanceMeters <= 0 ||
		durationSeconds <= 0
	)
		return null;
	return (distanceMeters * 3.6) / durationSeconds;
}

export function enduranceTotals(
	activities: readonly Pick<
		ActivitySummary,
		"distanceMeters" | "durationSeconds"
	>[],
) {
	const distanceMeters = activities.reduce(
		(sum, item) => sum + (item.distanceMeters ?? 0),
		0,
	);
	const durationSeconds = activities.reduce(
		(sum, item) => sum + item.durationSeconds,
		0,
	);
	return {
		count: activities.length,
		distanceMeters,
		durationSeconds,
		paceSecondsPerKilometer: paceSecondsPerKilometer(
			distanceMeters,
			durationSeconds,
		),
		speedKilometersPerHour: speedKilometersPerHour(
			distanceMeters,
			durationSeconds,
		),
	};
}
