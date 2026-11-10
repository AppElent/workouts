import {
	type Locale,
	normalizeCombo,
	normalizePersonalFood,
	type Combo as StoredCombo,
} from "@foundry/core";
import { getShippedFood } from "@foundry/core/shipped-foods";
import type { LibraryRecord } from "./nutrition-library-repository";
import type {
	Combo,
	PersonalFood,
	PersonalFoodFilter,
} from "./personal-food-repository";

/**
 * The account's library items received from Convex this session, with the
 * revision each arrived at. Combos may arrive before the Foods they use.
 */
export type PersonalFoodCache = {
	/** Most recently updated first. */
	list(filter?: PersonalFoodFilter): PersonalFood[];
	find(id: string): PersonalFood | undefined;
	findByBarcode(barcode: string): PersonalFood | undefined;
	/** Matches either language's name; sorted by the name in `locale`. */
	search(
		query: string,
		locale: Locale,
		filter?: PersonalFoodFilter,
	): PersonalFood[];
	/**
	 * Every food forked from a shipped one, most recently updated first — the
	 * order that decides which of two corrections of a food stands in front.
	 */
	forks(): PersonalFood[];
	/** The correction standing in front of a shipped food, if there is one. */
	findForkOf(shippedId: string): PersonalFood | undefined;
	listCombos(): Combo[];
	findCombo(id: string): Combo | undefined;
	/** The server revision of an item; 0 when none has arrived. */
	revisionOf(id: string): number;
	isDeleted(id: string): boolean;
	/** Takes a server record unless a newer one is here already, and returns the one kept. */
	receive(record: LibraryRecord): LibraryRecord;
	/** Foods whose photo is only on this device, until the server has them. */
	keepDeviceFoods(foods: readonly PersonalFood[]): void;
};

const newestFirst = (
	left: { updatedAt: number; id: string },
	right: { updatedAt: number; id: string },
) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id);

export function createPersonalFoodCache(): PersonalFoodCache {
	const records = new Map<string, LibraryRecord>();
	const foods = new Map<string, PersonalFood>();
	const combos = new Map<string, StoredCombo>();

	const find = (id: string) => foods.get(id);
	const list = (filter?: PersonalFoodFilter) =>
		[...foods.values()]
			.filter(
				(item) =>
					!filter?.classification ||
					item.classification === filter.classification,
			)
			.sort(newestFirst);
	const resolve = (stored: StoredCombo): Combo => ({
		...stored,
		parts: stored.parts.map((part) => ({
			...part,
			id: part.id ?? "",
			status:
				part.reference.kind === "oneOff"
					? "available"
					: part.reference.kind === "shipped"
						? getShippedFood(part.reference.foodId)
							? "available"
							: "missing"
						: find(part.reference.foodId)
							? "available"
							: "unloaded",
		})),
	});
	const forks = () =>
		list().filter((item) => item.provenance.forkedFrom !== undefined);

	return {
		list,
		find,
		findByBarcode: (barcode) =>
			list().find((item) => item.provenance.barcode === barcode),
		search(query, locale, filter) {
			const needle = query.trim().toLocaleLowerCase(locale);
			if (!needle) return list(filter);
			const other = locale === "en" ? "nl" : "en";
			return list(filter)
				.filter((item) =>
					[item.name[locale], item.name[other]].some((name) =>
						name.toLocaleLowerCase(locale).includes(needle),
					),
				)
				.sort((left, right) =>
					left.name[locale].localeCompare(right.name[locale], locale),
				);
		},
		forks,
		findForkOf: (shippedId) =>
			forks().find((item) => item.provenance.forkedFrom === shippedId),
		listCombos: () => [...combos.values()].sort(newestFirst).map(resolve),
		findCombo(id) {
			const stored = combos.get(id);
			return stored ? resolve(stored) : undefined;
		},
		revisionOf: (id) => records.get(id)?.revision ?? 0,
		isDeleted: (id) => records.get(id)?.deleted ?? false,
		receive(record) {
			const current = records.get(record.id);
			if (current && current.revision > record.revision) return current;
			if (record.deleted) {
				foods.delete(record.id);
				combos.delete(record.id);
			} else if (record.kind === "combo")
				combos.set(
					record.id,
					normalizeCombo(JSON.parse(record.payload ?? "null")),
				);
			else {
				const incoming = normalizePersonalFood(
					JSON.parse(record.payload ?? "null"),
				);
				// The server keeps no photo that is not uploaded yet; the file stays here.
				const local = foods.get(record.id)?.visual;
				foods.set(
					record.id,
					!incoming.visual && local?.kind === "photo"
						? { ...incoming, visual: local }
						: incoming,
				);
			}
			records.set(record.id, record);
			return record;
		},
		keepDeviceFoods(deviceFoods) {
			for (const item of deviceFoods)
				if (!records.has(item.id))
					foods.set(item.id, normalizePersonalFood(item));
		},
	};
}
