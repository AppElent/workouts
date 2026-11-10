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

/** "Time cap 12:00" for For Time, "20 min" for AMRAP/EMOM, or null. */
export function formatWodTiming(block: {
	type: WodType;
	timeCapSeconds?: number;
	durationSeconds?: number;
}): string | null {
	if (block.type === "forTime" && block.timeCapSeconds)
		return `Time cap ${formatClock(block.timeCapSeconds)}`;
	if (
		(block.type === "amrap" || block.type === "emom") &&
		block.durationSeconds
	)
		return `${Math.round(block.durationSeconds / 60)} min`;
	return null;
}

/** Persisted movements have no id; read-only lists key them by content. */
export function movementKey(prefix: string, movement: WodMovement): string {
	return `${prefix}:${movement.name}:${movement.reps ?? ""}:${
		movement.weight ?? ""
	}:${movement.unit ?? ""}`;
}
