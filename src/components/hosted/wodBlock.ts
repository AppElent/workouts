import type { Doc } from "@convex/_generated/dataModel";
import {
	fmt,
	formatClock,
	WOD_TIMING_FIELD,
	type WodMovement,
	type WodTiming,
	type WodTimingField,
	type WodType,
} from "@foundry/core";

export type HostedWodBlock =
	Doc<"hostedWorkouts">["template"]["wodBlocks"][number];

/** The `labels` entry for a WOD type's timing field, or null when it has none. */
export function wodTimingLabel<T>(
	type: WodType,
	labels: Record<WodTimingField, T>,
): T | null {
	const field = WOD_TIMING_FIELD[type];
	return field ? labels[field] : null;
}

/** "Time cap 12:00" for For Time, "20 min" for AMRAP/EMOM, or null. */
export function formatWodTiming(
	block: { type: WodType } & WodTiming,
	messages: { timeCap: string; minutes: string },
) {
	const field = WOD_TIMING_FIELD[block.type];
	const seconds = field ? block[field] : undefined;
	if (!seconds) return null;
	return field === "timeCapSeconds"
		? fmt(messages.timeCap, { time: formatClock(seconds) })
		: fmt(messages.minutes, { count: Math.round(seconds / 60) });
}

/** Persisted movements have no id; read-only lists key them by content. */
export function movementKey(prefix: string, movement: WodMovement): string {
	return [
		prefix,
		movement.name,
		movement.reps,
		movement.weight,
		movement.unit,
		movement.distance,
		movement.distanceUnit,
		movement.notes,
	].join(":");
}
