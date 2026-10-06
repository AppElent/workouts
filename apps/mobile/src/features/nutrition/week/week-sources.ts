import type { NutrientKey, NutrientValue } from "@workouts/core/nutrition";

type SourceEntry = {
	id: string;
	date: string;
	name: { en: string; nl: string };
	nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	provenance: { source: string; sourceId?: string };
};

/** One food over the week: every entry of it, summed, ranked by amount. */
export type WeekSource<T extends SourceEntry> = {
	key: string;
	name: T["name"];
	amount: number;
	share: number;
	entries: T[];
};

function foodKey(entry: SourceEntry) {
	return entry.provenance.sourceId
		? `${entry.provenance.source}:${entry.provenance.sourceId}`
		: `name:${entry.name.en}`;
}

/** Call with underlying Diary Entries, never both a Logged Combo and its parts. */
export function groupWeekSources<T extends SourceEntry>(
	entries: readonly T[],
	nutrient: NutrientKey,
): {
	total: number;
	ranked: WeekSource<T>[];
	/** Entries without a value for the nutrient, per day. */
	missingByDate: Record<string, number>;
} {
	const groups = new Map<string, WeekSource<T>>();
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
		const group: WeekSource<T> = groups.get(key) ?? {
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
