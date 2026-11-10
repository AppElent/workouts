import type { Doc } from "@convex/_generated/dataModel";
import {
	formatClock,
	type HostedLevel,
	type WodMovement,
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

type WodTiming = { timeCapSeconds?: number; durationSeconds?: number };

/** For Time stores a time cap, AMRAP/EMOM a duration; Load has no timing. */
export const WOD_TIMING: Record<
	WodType,
	{ field: keyof WodTiming; label: string } | null
> = {
	forTime: { field: "timeCapSeconds", label: "Time cap" },
	amrap: { field: "durationSeconds", label: "Duration" },
	emom: { field: "durationSeconds", label: "Duration" },
	load: null,
};

/** The timing fields for `minutes` entered on a WOD of `type`; the other field clears. */
export function wodTimingFromMinutes(
	type: WodType,
	minutes: number | undefined,
): WodTiming {
	const field = WOD_TIMING[type]?.field;
	const seconds = minutes ? minutes * 60 : undefined;
	return {
		timeCapSeconds: field === "timeCapSeconds" ? seconds : undefined,
		durationSeconds: field === "durationSeconds" ? seconds : undefined,
	};
}

/** The minutes a WOD's timing field holds, if any. */
export function wodTimingMinutes(block: { type: WodType } & WodTiming) {
	const field = WOD_TIMING[block.type]?.field;
	const seconds = field ? block[field] : undefined;
	return seconds ? seconds / 60 : undefined;
}

/** "Time cap 12:00" for For Time, "20 min" for AMRAP/EMOM, or null. */
export function formatWodTiming(block: { type: WodType } & WodTiming) {
	const field = WOD_TIMING[block.type]?.field;
	const seconds = field ? block[field] : undefined;
	if (!seconds) return null;
	return field === "timeCapSeconds"
		? `Time cap ${formatClock(seconds)}`
		: `${Math.round(seconds / 60)} min`;
}

/** Persisted movements have no id; read-only lists key them by content. */
export function movementKey(prefix: string, movement: WodMovement): string {
	return `${prefix}:${movement.name}:${movement.reps ?? ""}:${
		movement.weight ?? ""
	}:${movement.unit ?? ""}`;
}
