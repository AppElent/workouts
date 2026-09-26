import type { EnduranceCopy } from "./endurance-copy";

export type EnduranceValues = {
	date: string;
	time: string;
	distance: string;
	hours: string;
	minutes: string;
	seconds: string;
	title: string;
	notes: string;
	environment: "indoor" | "outdoor" | "";
	elevation: string;
	heartRate: string;
	effort: string;
};

export type EnduranceDetail = {
	id: string;
	sport: "running" | "cycling";
	occurredAt: number;
	durationSeconds: number;
	distanceMeters: number;
	title?: string;
	notes?: string;
	environment?: "indoor" | "outdoor";
	elevationGainMeters?: number;
	averageHeartRate?: number;
	effort?: number;
	createdAt: number;
	updatedAt: number;
};

const pad = (value: number) => String(value).padStart(2, "0");

export function formatPace(secondsPerKilometer: number | null) {
	if (secondsPerKilometer === null || !Number.isFinite(secondsPerKilometer))
		return "—";
	const rounded = Math.round(secondsPerKilometer);
	return `${Math.floor(rounded / 60)}:${pad(rounded % 60)} /km`;
}

export function valuesForActivity(
	activity?: EnduranceDetail | null,
): EnduranceValues {
	const date = new Date(activity?.occurredAt ?? Date.now());
	const seconds = activity?.durationSeconds ?? 0;
	return {
		date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
		time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
		distance: activity ? String(activity.distanceMeters / 1000) : "",
		hours: activity ? String(Math.floor(seconds / 3600)) : "",
		minutes: activity ? String(Math.floor((seconds % 3600) / 60)) : "",
		seconds: activity ? String(seconds % 60) : "",
		title: activity?.title ?? "",
		notes: activity?.notes ?? "",
		environment: activity?.environment ?? "",
		elevation:
			activity?.elevationGainMeters === undefined
				? ""
				: String(activity.elevationGainMeters),
		heartRate:
			activity?.averageHeartRate === undefined
				? ""
				: String(activity.averageHeartRate),
		effort: activity?.effort === undefined ? "" : String(activity.effort),
	};
}

function decimal(raw: string) {
	const normalized = raw.trim().replace(",", ".");
	if (!/^(?:\d+)(?:\.\d+)?$/.test(normalized)) return Number.NaN;
	return Number(normalized);
}

function whole(raw: string) {
	if (!/^\d+$/.test(raw.trim())) return Number.NaN;
	return Number(raw.trim());
}

function optionalText(raw: string) {
	return raw.trim() || null;
}

export type ParsedEnduranceValues = {
	occurredAt: number;
	distanceMeters: number;
	durationSeconds: number;
	title: string | null;
	notes: string | null;
	environment: "indoor" | "outdoor" | null;
	elevationGainMeters: number | null;
	averageHeartRate: number | null;
	effort: number | null;
};

export function parseEnduranceValues(
	values: EnduranceValues,
	copy: EnduranceCopy,
):
	| { value: ParsedEnduranceValues; error?: never }
	| { value?: never; error: string } {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(values.date.trim());
	const clock = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(values.time.trim());
	if (!match || !clock) return { error: copy.invalidDate };
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const occurredAt = new Date(
		year,
		month - 1,
		day,
		Number(clock[1]),
		Number(clock[2]),
	);
	if (
		occurredAt.getFullYear() !== year ||
		occurredAt.getMonth() !== month - 1 ||
		occurredAt.getDate() !== day ||
		occurredAt.getHours() !== Number(clock[1]) ||
		occurredAt.getMinutes() !== Number(clock[2]) ||
		occurredAt.getTime() > Date.now()
	)
		return { error: copy.invalidDate };
	const distanceKm = decimal(values.distance);
	if (!(distanceKm > 0) || !Number.isFinite(distanceKm * 1000))
		return { error: copy.invalidDistance };
	const hours = values.hours.trim() ? whole(values.hours) : 0;
	const minutes = values.minutes.trim() ? whole(values.minutes) : 0;
	const seconds = values.seconds.trim() ? whole(values.seconds) : 0;
	const durationSeconds = hours * 3600 + minutes * 60 + seconds;
	if (
		!Number.isSafeInteger(durationSeconds) ||
		durationSeconds <= 0 ||
		minutes > 59 ||
		seconds > 59
	)
		return { error: copy.invalidDuration };
	const elevationGainMeters = values.elevation.trim()
		? decimal(values.elevation)
		: null;
	if (
		elevationGainMeters !== null &&
		(!Number.isFinite(elevationGainMeters) || elevationGainMeters < 0)
	)
		return { error: copy.invalidElevation };
	const averageHeartRate = values.heartRate.trim()
		? whole(values.heartRate)
		: null;
	if (
		averageHeartRate !== null &&
		(!Number.isSafeInteger(averageHeartRate) || averageHeartRate <= 0)
	)
		return { error: copy.invalidHeartRate };
	const effort = values.effort.trim() ? whole(values.effort) : null;
	if (
		effort !== null &&
		(!Number.isSafeInteger(effort) || effort < 1 || effort > 10)
	)
		return { error: copy.invalidEffort };
	if (values.title.trim().length > 200) return { error: copy.invalidTitle };
	if (values.notes.trim().length > 10_000) return { error: copy.invalidNotes };
	return {
		value: {
			occurredAt: occurredAt.getTime(),
			distanceMeters: distanceKm * 1000,
			durationSeconds,
			title: optionalText(values.title),
			notes: optionalText(values.notes),
			environment: values.environment || null,
			elevationGainMeters,
			averageHeartRate,
			effort,
		},
	};
}
