import {
	libraryRecordFromCombo,
	libraryRecordFromFood,
} from "../data/nutrition-library-repository";
import {
	createPersonalFoodCache,
	type PersonalFoodCache,
} from "../data/personal-food-cache";
import {
	type Combo,
	type ComboDraft,
	normalizeComboDraft,
	normalizePersonalFoodDraft,
	type PersonalFood,
	type PersonalFoodDraft,
} from "../data/personal-food-repository";

/**
 * The account library as the server holds it: tests seed it, the provider
 * reads it as its session cache, and assertions read what was saved.
 */
export type LibraryFixture = PersonalFoodCache & {
	create(draft: PersonalFoodDraft, id?: string): PersonalFood;
	update(id: string, draft: PersonalFoodDraft): PersonalFood;
	remove(id: string): void;
	createCombo(draft: ComboDraft, id?: string): Combo;
	updateCombo(id: string, draft: ComboDraft): Combo;
};

let sequence = 0;
const nextId = () => `fixture-${++sequence}`;

export function createLibraryFixture(): LibraryFixture {
	const cache = createPersonalFoodCache();
	const store = (food: PersonalFood) => {
		cache.receive(libraryRecordFromFood(food, cache.revisionOf(food.id) + 1));
		return cache.find(food.id) as PersonalFood;
	};
	const storeCombo = (combo: Omit<Combo, "parts"> & ComboDraft) => {
		cache.receive(
			libraryRecordFromCombo(combo as Combo, cache.revisionOf(combo.id) + 1),
		);
		return cache.findCombo(combo.id) as Combo;
	};
	const withPartIds = (draft: ComboDraft) => {
		const valid = normalizeComboDraft(draft);
		return {
			...valid,
			parts: valid.parts.map((part) => ({ ...part, id: part.id ?? nextId() })),
		};
	};
	return {
		...cache,
		create(draft, id = nextId()) {
			const now = Date.now();
			return store({
				...normalizePersonalFoodDraft(draft),
				id,
				createdAt: now,
				updatedAt: now,
			});
		},
		update(id, draft) {
			const current = cache.find(id);
			if (!current) throw new Error(`No food ${id}.`);
			return store({
				...normalizePersonalFoodDraft(draft),
				id,
				createdAt: current.createdAt,
				updatedAt: Math.max(Date.now(), current.updatedAt + 1),
			});
		},
		remove(id) {
			cache.receive({
				id,
				kind: cache.findCombo(id) ? "combo" : "food",
				payload: null,
				revision: cache.revisionOf(id) + 1,
				deleted: true,
			});
		},
		createCombo(draft, id = nextId()) {
			const now = Date.now();
			return storeCombo({
				...withPartIds(draft),
				id,
				createdAt: now,
				updatedAt: now,
			});
		},
		updateCombo(id, draft) {
			const current = cache.findCombo(id);
			if (!current) throw new Error(`No combo ${id}.`);
			return storeCombo({
				...withPartIds(draft),
				id,
				createdAt: current.createdAt,
				updatedAt: Math.max(Date.now(), current.updatedAt + 1),
			});
		},
	};
}
