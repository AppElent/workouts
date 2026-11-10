import { type EnduranceField, validateEnduranceInput } from "@foundry/core";
import { type Messages, parseLocalizedDecimal } from "../../../i18n";

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
	const value = parseLocalizedDecimal(raw);
	return value === undefined || value < 0 ? Number.NaN : value;
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

/** The typed date and time as a timestamp; NaN when it names no real minute. */
function occurredAtFrom(date: string, time: string) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
	const clock = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
	if (!match || !clock) return Number.NaN;
	const [year, month, day] = match.slice(1).map(Number);
	const [hour, minute] = clock.slice(1).map(Number);
	const value = new Date(year, month - 1, day, hour, minute);
	return value.getFullYear() === year &&
		value.getMonth() === month - 1 &&
		value.getDate() === day &&
		value.getHours() === hour &&
		value.getMinutes() === minute
		? value.getTime()
		: Number.NaN;
}

/** Reads the form's text into an activity and checks it with the server's rules. */
export function parseEnduranceValues(
	values: EnduranceValues,
	copy: Messages["endurance"],
):
	| { value: ParsedEnduranceValues; error?: never }
	| { value?: never; error: string } {
	const messages: Record<EnduranceField, string> = {
		occurredAt: copy.invalidDate,
		distanceMeters: copy.invalidDistance,
		durationSeconds: copy.invalidDuration,
		elevationGainMeters: copy.invalidElevation,
		averageHeartRate: copy.invalidHeartRate,
		effort: copy.invalidEffort,
		title: copy.invalidTitle,
		notes: copy.invalidNotes,
	};
	const optional = (raw: string, read: (raw: string) => number) =>
		raw.trim() ? read(raw) : null;
	const hours = optional(values.hours, whole) ?? 0;
	const minutes = optional(values.minutes, whole) ?? 0;
	const seconds = optional(values.seconds, whole) ?? 0;
	const value: ParsedEnduranceValues = {
		occurredAt: occurredAtFrom(values.date, values.time),
		distanceMeters: decimal(values.distance) * 1000,
		durationSeconds: hours * 3600 + minutes * 60 + seconds,
		title: optionalText(values.title),
		notes: optionalText(values.notes),
		environment: values.environment || null,
		elevationGainMeters: optional(values.elevation, decimal),
		averageHeartRate: optional(values.heartRate, whole),
		effort: optional(values.effort, whole),
	};
	const checked = validateEnduranceInput(value);
	if (!checked.ok) return { error: messages[checked.errors[0].field] };
	if (minutes > 59 || seconds > 59) return { error: copy.invalidDuration };
	return { value };
}
