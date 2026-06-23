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

/**
 * Human-readable improvement of `current` over the `previousBest` score, or
 * null when there's no meaningful scalar delta to show. Used to surface the
 * "beat your Fran time by 0:22" hook when a result is a new PR.
 */
export function prImprovement(
	type: WodType,
	current: WodScoreInput,
	previousBest: WodScoreInput,
): string | null {
	switch (type) {
		case "forTime": {
			// Only comparable when both finished (uncapped).
			if (current.timeCapped || previousBest.timeCapped) return null;
			const delta = (previousBest.timeSeconds ?? 0) - (current.timeSeconds ?? 0);
			return delta > 0 ? `−${formatSeconds(delta)}` : null;
		}
		case "emom": {
			const delta = (current.reps ?? 0) - (previousBest.reps ?? 0);
			return delta > 0 ? `+${delta} reps` : null;
		}
		case "load": {
			const cur = scoreRank(type, current);
			const prev = scoreRank(type, previousBest);
			const delta = cur - prev;
			const unit = current.loadUnit ?? "kg";
			// scoreRank normalizes load to kg; show delta in the result's own unit.
			const shown = unit === "lbs" ? delta / KG_PER_LB : delta;
			return delta > 0 ? `+${Math.round(shown * 10) / 10} ${unit}` : null;
		}
		case "amrap": {
			const delta = scoreRank(type, current) - scoreRank(type, previousBest);
			if (delta <= 0) return null;
			const rounds = Math.floor(delta / AMRAP_ROUND_MULT);
			const reps = delta % AMRAP_ROUND_MULT;
			if (rounds > 0)
				return `+${rounds} round${rounds > 1 ? "s" : ""}${reps ? ` ${reps}` : ""}`;
			return `+${reps} reps`;
		}
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
