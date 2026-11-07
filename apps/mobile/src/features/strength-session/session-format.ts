import { convertLoad, roundLoad } from "@foundry/core";
import { fmt, plural } from "../../i18n";
import { type PlanSet, shownLoad } from "./session-plan";

export function formatNumber(value: number, locale: string, digits = 2) {
	return value.toLocaleString(locale, { maximumFractionDigits: digits });
}
/** "1:30", and "1:02:47" past an hour. */
export function formatClock(seconds: number) {
	const safe = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(safe / 3600);
	const minutes = Math.floor((safe % 3600) / 60);
	const rest = safe % 60;
	const pad = (value: number) => value.toString().padStart(2, "0");
	return hours > 0
		? `${hours}:${pad(minutes)}:${pad(rest)}`
		: `${minutes}:${pad(rest)}`;
}
/** "95 × 5" for kg, "209,4 lbs × 5" for pounds, "+10 × 12" on bodyweight. */
export function formatSetShort(
	row: Pick<PlanSet, "kg" | "unit" | "typedLbs" | "reps">,
	bodyweight: boolean,
	locale: string,
) {
	const load = formatNumber(shownLoad(row), locale, row.unit === "lbs" ? 1 : 2);
	if (bodyweight) return `+${load} × ${row.reps}`;
	return row.unit === "lbs"
		? `${load} lbs × ${row.reps}`
		: `${load} × ${row.reps}`;
}
/** "95 kg × 5", used where the load stands on its own. */
export function formatSetFull(
	row: Pick<PlanSet, "kg" | "unit" | "typedLbs" | "reps">,
	bodyweight: boolean,
	locale: string,
) {
	const load = formatNumber(shownLoad(row), locale, row.unit === "lbs" ? 1 : 2);
	return bodyweight
		? `+${load} × ${row.reps}`
		: `${load} ${row.unit} × ${row.reps}`;
}
export function formatLoadOnly(
	row: Pick<PlanSet, "kg" | "unit" | "typedLbs">,
	bodyweight: boolean,
	locale: string,
) {
	const load = formatNumber(shownLoad(row), locale, row.unit === "lbs" ? 1 : 2);
	return bodyweight ? `+${load} kg` : `${load} ${row.unit}`;
}
/** Reads a 1RM in the same unit as the set it came from. */
export function formatOneRm(
	valueKg: number,
	unit: "kg" | "lbs",
	locale: string,
) {
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
