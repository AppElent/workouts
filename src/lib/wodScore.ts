export type WodType = "forTime" | "amrap" | "emom" | "load";

export interface WodScoreInput {
	timeSeconds?: number;
	rounds?: number;
	reps?: number;
	timeCapped?: boolean;
	load?: number;
	loadUnit?: "kg" | "lbs";
}

const KG_PER_LB = 0.45359237;
// Capped For-Time results always rank below any finished result.
const CAP_OFFSET = 1_000_000_000;
// Assumes a single AMRAP round never exceeds this many reps.
const AMRAP_ROUND_MULT = 100_000;

export function formatSeconds(totalSeconds: number): string {
	const safe = Math.max(0, Math.floor(totalSeconds));
	const m = Math.floor(safe / 60);
	const s = safe % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatScore(type: WodType, score: WodScoreInput): string {
	switch (type) {
		case "forTime":
			if (score.timeCapped) return `CAP+${score.reps ?? 0}`;
			return formatSeconds(score.timeSeconds ?? 0);
		case "amrap":
			return `${score.rounds ?? 0} + ${score.reps ?? 0}`;
		case "emom":
			return `${score.reps ?? 0} reps`;
		case "load":
			return `${score.load ?? 0} ${score.loadUnit ?? "kg"}`;
	}
}

/** Higher = better, for every type. */
export function scoreRank(type: WodType, score: WodScoreInput): number {
	switch (type) {
		case "forTime":
			if (score.timeCapped) {
				// Below every finisher; more reps completed = better among capped.
				return -CAP_OFFSET + (score.reps ?? 0);
			}
			// Faster = higher rank (less negative).
			return -(score.timeSeconds ?? 0);
		case "amrap":
			return (score.rounds ?? 0) * AMRAP_ROUND_MULT + (score.reps ?? 0);
		case "emom":
			return score.reps ?? 0;
		case "load":
			return score.loadUnit === "lbs"
				? (score.load ?? 0) * KG_PER_LB
				: (score.load ?? 0);
	}
}

/** Returns the highest-ranked score, or null if the list is empty. */
export function bestScore<T extends WodScoreInput>(
	type: WodType,
	scores: T[],
): T | null {
	if (scores.length === 0) return null;
	let best = scores[0];
	let bestRank = scoreRank(type, best);
	for (const s of scores) {
		const r = scoreRank(type, s);
		if (r > bestRank) {
			best = s;
			bestRank = r;
		}
	}
	return best;
}
