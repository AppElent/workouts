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

export type FoodSourceEntry = {
	id: string;
	date: string;
	name: { en: string; nl: string };
	nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	provenance: { source: string; sourceId?: string };
};

/** One food over a period: every entry of it, summed, ranked by amount. */
export type FoodNutrientSource<T extends FoodSourceEntry> = {
	key: string;
	name: T["name"];
	amount: number;
	share: number;
	entries: T[];
};

function foodKey(entry: FoodSourceEntry) {
	return entry.provenance.sourceId
		? `${entry.provenance.source}:${entry.provenance.sourceId}`
		: `name:${entry.name.en}`;
}

/**
 * Ranks foods rather than single entries: entries of the same source add up.
 * Call with underlying Diary Entries, never both a Logged Combo and its parts.
 */
export function groupFoodNutrientSources<T extends FoodSourceEntry>(
	entries: readonly T[],
	nutrient: NutrientKey,
): {
	total: number;
	ranked: FoodNutrientSource<T>[];
	/** Entries without a value for the nutrient, per day. */
	missingByDate: Record<string, number>;
} {
	const groups = new Map<string, FoodNutrientSource<T>>();
	const missingByDate: Record<string, number> = {};
	let total = 0;
	for (const entry of entries) {
		const value = entry.nutrients[nutrient];
		if (value.kind === "absent") {
			missingByDate[entry.date] = (missingByDate[entry.date] ?? 0) + 1;
			continue;
		}
		const amount = value.kind === "value" ? value.amount : 0;
		total += amount;
		const key = foodKey(entry);
		const group: FoodNutrientSource<T> = groups.get(key) ?? {
			key,
			name: entry.name,
			amount: 0,
			share: 0,
			entries: [],
		};
		group.amount += amount;
		group.entries.push(entry);
		groups.set(key, group);
	}
	const ranked = [...groups.values()]
		.map((group) => ({
			...group,
			share: total > 0 ? group.amount / total : 0,
			entries: [...group.entries].sort((a, b) => a.date.localeCompare(b.date)),
		}))
		.sort((a, b) => b.amount - a.amount);
	return { total, ranked, missingByDate };
}
