import type { NutrientKey, NutrientValue } from "./nutrients";

/** Call with underlying Diary Entries, never both a Logged Combo and its parts. */
export function rankNutrientSources<
	T extends { nutrients: Readonly<Record<NutrientKey, NutrientValue>> },
>(entries: readonly T[], nutrient: NutrientKey) {
	const missing: T[] = [];
	const known: { entry: T; amount: number; trace: boolean }[] = [];
	for (const entry of entries) {
		const value = entry.nutrients[nutrient];
		if (value.kind === "absent") missing.push(entry);
		else
			known.push({
				entry,
				amount: value.kind === "value" ? value.amount : 0,
				trace: value.kind === "trace",
			});
	}
	const total = known.reduce((sum, item) => sum + item.amount, 0);
	return {
		missing,
		total,
		ranked: known
			.sort((a, b) => b.amount - a.amount)
			.map((item) => ({ ...item, share: total > 0 ? item.amount / total : 0 })),
	};
}
