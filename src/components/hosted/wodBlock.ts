import type { Doc } from "@convex/_generated/dataModel";
import {
	formatClock,
	type HostedLevel,
	WOD_TIMING_FIELD,
	type WodMovement,
	type WodTiming,
	type WodTimingField,
	type WodType,
} from "@foundry/core";

export type HostedWodBlock =
	Doc<"hostedWorkouts">["template"]["wodBlocks"][number];

export const HOSTED_LEVEL_LABELS: Record<HostedLevel, string> = {
	rx: "Rx",
	l1: "L1",
	l2: "L2",
	l3: "L3",
};

/** The host's label for a level, or the canonical Rx/L1/L2/L3 name. */
export function levelLabel(
	block: Pick<HostedWodBlock, "levels">,
	level: HostedLevel,
): string {
	return (
		block.levels.find((entry) => entry.level === level)?.label ||
		HOSTED_LEVEL_LABELS[level]
	);
}

export const WOD_TYPE_LABELS: Record<WodType, string> = {
	forTime: "For Time",
	amrap: "AMRAP",
	emom: "EMOM",
	load: "Load",
};

const WOD_TIMING_LABELS: Record<WodTimingField, string> = {
	timeCapSeconds: "Time cap",
	durationSeconds: "Duration",
};

/** "Time cap" or "Duration" for a WOD type that has timing, else null. */
export function wodTimingLabel(type: WodType): string | null {
	const field = WOD_TIMING_FIELD[type];
	return field ? WOD_TIMING_LABELS[field] : null;
}

/** "Time cap 12:00" for For Time, "20 min" for AMRAP/EMOM, or null. */
export function formatWodTiming(block: { type: WodType } & WodTiming) {
	const field = WOD_TIMING_FIELD[block.type];
	const seconds = field ? block[field] : undefined;
	if (!seconds) return null;
	return field === "timeCapSeconds"
		? `Time cap ${formatClock(seconds)}`
		: `${Math.round(seconds / 60)} min`;
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
