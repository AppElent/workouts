/**
 * Rough strength levels per lift (APP-255), for people who don't know their
 * 1RM: where a set lands and what to start with. Ratios are 1RM over
 * bodyweight, rounded from common published standards; a guide, not a test.
 * Dumbbell lifts count one dumbbell.
 */
import { convertLoad, type LoadUnit } from "@foundry/core";

export const LEVEL_IDS = [
	"beginner",
	"intermediate",
	"advanced",
	"expert",
] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

/** Where each level starts, as 1RM ÷ bodyweight. */
type Ratios = readonly [number, number, number, number];

const BENCH: Ratios = [0.5, 1, 1.5, 1.9];
const DEADLIFT: Ratios = [1, 1.5, 2, 2.6];
const ROW: Ratios = [0.5, 0.85, 1.15, 1.5];
const RATIOS: Record<string, Ratios> = {
	"barbell-back-squat": [0.75, 1.25, 1.75, 2.25],
	"front-squat": [0.6, 1, 1.4, 1.8],
	"barbell-bench-press": BENCH,
	"incline-barbell-press": [0.45, 0.85, 1.25, 1.6],
	"decline-barbell-press": BENCH,
	"close-grip-bench-press": [0.45, 0.9, 1.3, 1.65],
	"barbell-deadlift": DEADLIFT,
	"sumo-deadlift": DEADLIFT,
	"romanian-deadlift": [0.7, 1.15, 1.6, 2],
	"barbell-overhead-press": [0.35, 0.6, 0.85, 1.1],
	"push-press": [0.45, 0.8, 1.1, 1.4],
	"barbell-row": ROW,
	"pendlay-row": ROW,
	"t-bar-row": ROW,
	"hip-thrust": [0.75, 1.5, 2.25, 3],
	"leg-press": [1.5, 2.5, 3.5, 4.5],
	"dumbbell-bench-press": [0.2, 0.35, 0.5, 0.65],
	"dumbbell-shoulder-press": [0.15, 0.25, 0.35, 0.45],
	"dumbbell-curl": [0.1, 0.2, 0.3, 0.4],
	"hammer-curl": [0.1, 0.2, 0.3, 0.4],
	"ez-bar-curl": [0.25, 0.45, 0.65, 0.85],
};

const SHIPPED = "shipped:exercise:";
/** The catalog lift behind an exercise id, also for a retained copy. */
export function levelKey(exerciseId: string, shippedExerciseId?: string) {
	const id = shippedExerciseId ?? exerciseId;
	return id.startsWith(SHIPPED) ? id.slice(SHIPPED.length) : null;
}

export interface StrengthLevel {
	id: LevelId;
	/** 1RM ÷ bodyweight where this level starts and the next one begins. */
	from: number;
	to: number | null;
	/** Kilograms, when the bodyweight is known. */
	fromKg: number | null;
	toKg: number | null;
}

export function strengthLevels(
	key: string | null,
	bodyweightKg: number | null,
): StrengthLevel[] | null {
	const ratios = key ? RATIOS[key] : undefined;
	if (!ratios) return null;
	const kg = (ratio: number | null) =>
		ratio === null || !bodyweightKg ? null : Math.round(ratio * bodyweightKg);
	return LEVEL_IDS.map((id, index) => {
		const from = ratios[index] as number;
		const to = ratios[index + 1] ?? null;
		return { id, from, to, fromKg: kg(from), toKg: kg(to) };
	});
}

/** The level a 1RM sits in; below the first level counts as the first. */
export function levelOf(
	levels: readonly StrengthLevel[],
	oneRepMaxKg: number,
	bodyweightKg: number,
) {
	const ratio = oneRepMaxKg / bodyweightKg;
	let at = 0;
	levels.forEach((level, index) => {
		if (ratio >= level.from) at = index;
	});
	const next = levels[at + 1];
	return {
		index: at,
		/** Kilograms of 1RM to the next level, when there is one. */
		toNextKg: next
			? Math.max(0, Math.ceil(next.from * bodyweightKg - oneRepMaxKg))
			: null,
	};
}

/** A first working weight for about eight reps at this level: 75% of its middle. */
export function startLoadKg(level: StrengthLevel, bodyweightKg: number) {
	const middle = level.to === null ? level.from : (level.from + level.to) / 2;
	return middle * bodyweightKg * 0.75;
}

/** The latest logged bodyweight in kg, from newest-first entries. */
export function latestBodyweightKg(
	entries:
		| readonly { weight?: number | undefined; unit: LoadUnit }[]
		| undefined,
) {
	const entry = entries?.find((item) => item.weight !== undefined);
	return entry?.weight !== undefined
		? convertLoad(entry.weight, entry.unit, "kg")
		: null;
}
