import { fmt, type Locale, plural } from "../../i18n";
import type { strengthEn } from "../../i18n/messages/strength";

type StrengthCopy = typeof strengthEn;

/** The set types that read aloud; a working set says nothing. */
const SPOKEN_TYPES = ["warmup", "drop", "failure"] as const;
type SpokenType = (typeof SPOKEN_TYPES)[number];

export type SpokenSet = {
	/** 1-based position in the exercise's list. */
	number: number;
	/** A hold: `reps` counts seconds. */
	timed: boolean;
	weight: number;
	unit: "kg" | "lbs";
	reps: number;
	setType: string;
	/** Spoken in place of the set type of a working set, e.g. "RPE 8". */
	rpe?: number | null;
	/** Estimated 1RM in kg, when the row shows one. */
	estimateKg?: number | null;
	note: string;
};

/**
 * One spoken label for a set row: set number, load, reps, set type,
 * estimate and note, each only when the row has it. Never a placeholder
 * glyph: the row's visible "—" and "×" are not part of what is read.
 */
export function spokenSet(
	set: SpokenSet,
	strength: StrengthCopy,
	locale: Locale,
): string {
	const copy = strength.plan;
	const decimal = (value: number) =>
		value.toLocaleString(locale, { maximumFractionDigits: 2 });
	const unit = copy.unitSpoken[set.unit];
	const amount = plural(
		locale,
		set.reps,
		set.timed ? copy.secondsSpoken : copy.repsSpoken,
	);
	const weight =
		set.weight > 0
			? fmt(set.timed ? copy.weightAddedSpoken : copy.weightSpoken, {
					weight: decimal(set.weight),
					unit,
				})
			: "";
	const kind = SPOKEN_TYPES.includes(set.setType as SpokenType)
		? strength[set.setType as SpokenType]
		: set.rpe == null
			? ""
			: fmt(copy.rowRpeSpoken, { value: decimal(set.rpe) });
	const head = [fmt(copy.rowSet, { number: set.number }), weight, amount, kind]
		.filter(Boolean)
		.join(", ");
	const estimate =
		set.estimateKg == null
			? ""
			: fmt(copy.rowOneRmSpoken, {
					value: decimal(Math.round(set.estimateKg)),
					unit: copy.unitSpoken.kg,
				});
	const note = set.note ? fmt(copy.rowNoteSpoken, { note: set.note }) : "";
	return `${head}${estimate}${note}`;
}
