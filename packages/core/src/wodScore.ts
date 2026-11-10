import { formatClock } from "./format";
import { type NumberRange, type RangeCode, rangeCode } from "./range";
import { type RuleResult, ruleIssues } from "./rules";
import { type DistanceUnit, KG_PER_LB, type LoadUnit } from "./units";

export const WOD_TYPES = ["forTime", "amrap", "emom", "load"] as const;
export type WodType = (typeof WOD_TYPES)[number];

/** Hosted Workout scaling levels, from the prescribed workout down. */
export const HOSTED_LEVELS = ["rx", "l1", "l2", "l3"] as const;
export type HostedLevel = (typeof HOSTED_LEVELS)[number];

/** Whether a logged WOD result was done as prescribed. */
export const RX_SCALED = ["rx", "scaled"] as const;
export type RxScaled = (typeof RX_SCALED)[number];

export type WodMovement = {
	name: string;
	reps?: number;
	weight?: number;
	unit?: LoadUnit;
	distance?: number;
	distanceUnit?: DistanceUnit;
	notes?: string;
};

export interface WodScoreInput {
	timeSeconds?: number;
	rounds?: number;
	reps?: number;
	timeCapped?: boolean;
	load?: number;
	loadUnit?: LoadUnit;
}

export const SCORE_LIMITS = {
	timeSeconds: { min: 0, max: 86_400 },
	rounds: { min: 0, max: 10_000 },
	reps: { min: 0, max: 100_000 },
	load: { min: 0, max: 2000 },
} as const satisfies Record<string, NumberRange>;

export type WodScoreField = keyof typeof SCORE_LIMITS | "loadUnit";
export type WodScoreCode = RangeCode | "required";

/**
 * A score is complete for its WOD type: a finish time (or reps when capped),
 * rounds or reps for AMRAP, reps or rounds for EMOM, a load with its unit.
 * Every present number must be within `SCORE_LIMITS`.
 */
export function validateWodScore<T extends WodScoreInput>(
	type: WodType,
	score: T,
): RuleResult<T, WodScoreField, WodScoreCode> {
	const found = ruleIssues<WodScoreField, WodScoreCode>();
	for (const field of Object.keys(
		SCORE_LIMITS,
	) as (keyof typeof SCORE_LIMITS)[]) {
		const value = score[field];
		if (value === undefined) continue;
		const code = rangeCode(value, SCORE_LIMITS[field]);
		if (code) found.add(field, code);
	}
	switch (type) {
		case "forTime":
			if (score.timeCapped === true) {
				if (score.reps === undefined) found.add("reps", "required");
			} else if (score.timeSeconds === undefined)
				found.add("timeSeconds", "required");
			break;
		case "amrap":
			if (score.rounds === undefined && score.reps === undefined)
				found.add("rounds", "required");
			break;
		case "emom":
			if (score.reps === undefined && score.rounds === undefined)
				found.add("reps", "required");
			break;
		case "load":
			if (score.load === undefined) found.add("load", "required");
			if (score.loadUnit === undefined) found.add("loadUnit", "required");
			break;
	}
	return found.result(score);
}

export type WodScoreFields = {
	timeSeconds?: number;
	timeCapped?: boolean;
	rounds?: number;
	reps?: number;
	load?: number;
	loadUnit?: LoadUnit;
};

/**
 * The score a form submits: only the fields its WOD type ranks on, with
 * missing values left out rather than defaulted.
 */
export function buildWodScore(
	type: WodType,
	fields: WodScoreFields,
): WodScoreInput {
	const defined = (score: WodScoreInput) =>
		Object.fromEntries(
			Object.entries(score).filter(([, value]) => value !== undefined),
		) as WodScoreInput;
	switch (type) {
		case "forTime":
			return fields.timeCapped
				? defined({ timeCapped: true, reps: fields.reps })
				: defined({ timeSeconds: fields.timeSeconds });
		case "amrap":
			return defined({ rounds: fields.rounds, reps: fields.reps });
		case "emom":
			return defined({ reps: fields.reps });
		case "load":
			return defined({ load: fields.load, loadUnit: fields.loadUnit ?? "kg" });
	}
}

/** "12:30" or "750" both mean 750 seconds; anything else is undefined. */
export function parseClockInput(raw: string): number | undefined {
	const trimmed = raw.trim();
	const match = /^(?:(\d+):)?(\d+)$/.exec(trimmed);
	if (!match) return undefined;
	const minutes = match[1] === undefined ? 0 : Number(match[1]);
	return minutes * 60 + Number(match[2]);
}

// Capped For-Time results always rank below any finished result.
const CAP_OFFSET = 1_000_000_000;
// Assumes a single AMRAP round never exceeds this many reps.
const AMRAP_ROUND_MULT = 100_000;

export function formatScore(type: WodType, score: WodScoreInput): string {
	switch (type) {
		case "forTime":
			if (score.timeCapped) return `CAP+${score.reps ?? 0}`;
			return formatClock(score.timeSeconds ?? 0);
		case "amrap":
			return `${score.rounds ?? 0} + ${score.reps ?? 0}`;
		case "emom":
			return `${score.reps ?? 0} reps`;
		case "load":
			return `${score.load ?? 0} ${score.loadUnit ?? "kg"}`;
	}
}

/** Higher is better for every type; loads compare in kg. */
export function scoreRank(type: WodType, score: WodScoreInput): number {
	switch (type) {
		case "forTime":
			if (score.timeCapped) return -CAP_OFFSET + (score.reps ?? 0);
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

export type LeaderboardEntry = {
	readonly score: WodScoreInput;
	readonly submittedAt: number;
};

/** Better score first; equal scores go to whoever submitted first. */
export function compareLeaderboardEntries(
	type: WodType,
	a: LeaderboardEntry,
	b: LeaderboardEntry,
): number {
	return (
		scoreRank(type, b.score) - scoreRank(type, a.score) ||
		a.submittedAt - b.submittedAt
	);
}

export function sortLeaderboard<T extends LeaderboardEntry>(
	type: WodType,
	entries: readonly T[],
): T[] {
	return [...entries].sort((a, b) => compareLeaderboardEntries(type, a, b));
}

/** "21 Thrusters @ 43 kg", "Run 400 m", or just "Pull-ups". */
export function formatMovement(movement: WodMovement): string {
	const parts: string[] = [];
	if (movement.reps !== undefined) parts.push(String(movement.reps));
	parts.push(movement.name);
	if (movement.distance !== undefined)
		parts.push(`${movement.distance} ${movement.distanceUnit ?? "m"}`);
	const text = parts.join(" ").trim();
	return movement.weight === undefined
		? text
		: `${text} @ ${movement.weight} ${movement.unit ?? "kg"}`;
}

/**
 * Improvement of `current` over `previousBest`, or null when it is not better
 * or the two are not comparable (a capped For-Time result).
 */
export function prImprovement(
	type: WodType,
	current: WodScoreInput,
	previousBest: WodScoreInput,
): string | null {
	switch (type) {
		case "forTime": {
			if (current.timeCapped || previousBest.timeCapped) return null;
			const delta =
				(previousBest.timeSeconds ?? 0) - (current.timeSeconds ?? 0);
			return delta > 0 ? `−${formatClock(delta)}` : null;
		}
		case "emom": {
			const delta = (current.reps ?? 0) - (previousBest.reps ?? 0);
			return delta > 0 ? `+${delta} reps` : null;
		}
		case "load": {
			const delta = scoreRank(type, current) - scoreRank(type, previousBest);
			const unit = current.loadUnit ?? "kg";
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

/** The highest-ranked score, or null for an empty list. */
export function bestScore<T extends WodScoreInput>(
	type: WodType,
	scores: readonly T[],
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
