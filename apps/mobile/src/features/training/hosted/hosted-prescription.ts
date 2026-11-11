import type { Doc } from "../../../convex/api";

type StrengthBlock =
	Doc<"hostedWorkouts">["template"]["strengthBlocks"][number];

/** "5 × 3 · 80% 1RM", "5 × 3 · 60 kg", or null when the host set nothing. */
export function formatHostedPrescription(block: StrengthBlock): string | null {
	const parts: string[] = [];
	if (block.defaultSets !== undefined || block.defaultReps !== undefined)
		parts.push(`${block.defaultSets ?? "—"} × ${block.defaultReps ?? "—"}`);
	if (block.percentageOfOneRepMax)
		parts.push(`${block.percentageOfOneRepMax}% 1RM`);
	else if (block.defaultWeight)
		parts.push(`${block.defaultWeight} ${block.unit ?? "kg"}`);
	return parts.length > 0 ? parts.join(" · ") : null;
}
