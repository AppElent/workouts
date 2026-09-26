export type EnduranceSport = "running" | "cycling";
export type ActivitySport = "strength" | EnduranceSport;

export type ActivitySummary = {
	id: string;
	sport: ActivitySport;
	occurredAt: number;
	durationSeconds: number;
	title?: string;
	distanceMeters?: number;
};

export type EnduranceInput = {
	occurredAt: number;
	durationSeconds: number;
	distanceMeters: number;
	title?: string | null;
	notes?: string | null;
	environment?: "indoor" | "outdoor" | null;
	elevationGainMeters?: number | null;
	averageHeartRate?: number | null;
	effort?: number | null;
};

export function validateEnduranceInput(
	input: EnduranceInput,
	now = Date.now(),
): void {
	if (!Number.isSafeInteger(input.occurredAt) || input.occurredAt < 0) {
		throw new Error("Invalid activity date.");
	}
	if (input.occurredAt > now)
		throw new Error("Activity date cannot be in the future.");
	if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
		throw new Error("Duration must be positive.");
	}
	if (!Number.isFinite(input.distanceMeters) || input.distanceMeters <= 0) {
		throw new Error("Distance must be positive.");
	}
	if (
		input.elevationGainMeters != null &&
		(!Number.isFinite(input.elevationGainMeters) ||
			input.elevationGainMeters < 0)
	) {
		throw new Error("Elevation gain cannot be negative.");
	}
	if (
		input.averageHeartRate != null &&
		(!Number.isSafeInteger(input.averageHeartRate) ||
			input.averageHeartRate <= 0)
	) {
		throw new Error("Average heart rate must be a positive whole number.");
	}
	if (
		input.effort != null &&
		(!Number.isSafeInteger(input.effort) ||
			input.effort < 1 ||
			input.effort > 10)
	) {
		throw new Error("Effort must be between 1 and 10.");
	}
	if (input.title != null && input.title.length > 200)
		throw new Error("Title is too long.");
	if (input.notes != null && input.notes.length > 10_000)
		throw new Error("Notes are too long.");
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
