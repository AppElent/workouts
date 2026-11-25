import { convertLoad, type LoadUnit, roundLoad } from "@foundry/core";
import { fmt, plural } from "../../i18n";
import { type ExerciseFacts, type PlanSet, shownLoad } from "./session-plan";

export function formatNumber(value: number, locale: string, digits = 2) {
	return value.toLocaleString(locale, { maximumFractionDigits: digits });
}
/** How an exercise's sets read: added load on bodyweight, seconds on a hold. */
export type SetFormat = Pick<ExerciseFacts, "bodyweight" | "timed">;
export const LOADED_FORMAT: SetFormat = { bodyweight: false, timed: false };

/** "45 s" for a hold of 45 seconds. */
export function formatSeconds(seconds: number, locale: string) {
	return `${formatNumber(seconds, locale, 0)} s`;
}
function countOf(row: Pick<PlanSet, "reps">, kind: SetFormat, locale: string) {
	return kind.timed ? formatSeconds(row.reps, locale) : String(row.reps);
}
/**
 * "95 × 5" for kg, "209,4 lbs × 5" for pounds, "+10 × 12" on bodyweight, and
 * "45 s" (or "+10 × 45 s" with added load) on a hold.
 */
export function formatSetShort(
	row: Pick<PlanSet, "kg" | "unit" | "typedLbs" | "reps">,
	kind: SetFormat,
	locale: string,
) {
	const load = formatNumber(shownLoad(row), locale, row.unit === "lbs" ? 1 : 2);
	const count = countOf(row, kind, locale);
	if (kind.timed && kind.bodyweight && !(row.kg > 0)) return count;
	const sign = kind.bodyweight ? "+" : "";
	const unit = row.unit === "lbs" ? " lbs" : "";
	return `${sign}${load}${unit} × ${count}`;
}
/** "95 kg × 5", used where the load stands on its own. */
export function formatSetFull(
	row: Pick<PlanSet, "kg" | "unit" | "typedLbs" | "reps">,
	kind: SetFormat,
	locale: string,
) {
	if (kind.bodyweight) return formatSetShort(row, kind, locale);
	const load = formatNumber(shownLoad(row), locale, row.unit === "lbs" ? 1 : 2);
	return `${load} ${row.unit} × ${countOf(row, kind, locale)}`;
}
export function formatLoadOnly(
	row: Pick<PlanSet, "kg" | "unit" | "typedLbs">,
	kind: SetFormat,
	locale: string,
) {
	const load = formatNumber(shownLoad(row), locale, row.unit === "lbs" ? 1 : 2);
	return `${kind.bodyweight ? "+" : ""}${load} ${row.unit}`;
}
/** Reads a 1RM in the same unit as the set it came from. */
export function formatOneRm(valueKg: number, unit: LoadUnit, locale: string) {
	const value = roundLoad(convertLoad(valueKg, "kg", unit), 1);
	return `${formatNumber(value, locale, 0)} ${unit}`;
}
/** "3 rounds + 2 sets", or just the rounds when no extra sets were logged. */
export function formatScore(
	copy: {
		score: string;
		roundCount: { one: string; other: string };
		setCount: { one: string; other: string };
	},
	locale: string,
	score: { rounds: number; sets: number },
) {
	const rounds = plural(locale, score.rounds, copy.roundCount);
	if (!score.sets) return rounds;
	return fmt(copy.score, {
		rounds,
		sets: plural(locale, score.sets, copy.setCount),
	});
}
