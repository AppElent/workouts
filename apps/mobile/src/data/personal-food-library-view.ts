import type {
	Combo,
	ComboDraft,
	PersonalFoodRepository,
} from "./personal-food-repository";

/**
 * Before an explicit legacy claim, retain the existing device library while
 * exposing migrated recipes only to their account. New device foods keep the
 * existing legacy behavior; edits to account records remain account isolated.
 */
export function personalFoodLibraryView(
	legacy: PersonalFoodRepository,
	account: PersonalFoodRepository,
): PersonalFoodRepository {
	const find = (id: string) => account.find(id) ?? legacy.find(id);
	const hasAccountFood = (draft: ComboDraft) =>
		draft.parts.some(
			(part) =>
				part.reference.kind === "personal" &&
				account.find(part.reference.foodId) !== undefined,
		);
	const resolveCombo = (combo: Combo): Combo => ({
		...combo,
		parts: combo.parts.map((part) =>
			part.reference.kind === "personal"
				? {
						...part,
						status: find(part.reference.foodId) ? "available" : "missing",
					}
				: part,
		),
	});
	return {
		...legacy,
		list(filter) {
			const foods = new Map(legacy.list(filter).map((food) => [food.id, food]));
			for (const food of account.list(filter)) foods.set(food.id, food);
			return [...foods.values()].sort(
				(left, right) =>
					right.updatedAt - left.updatedAt || left.id.localeCompare(right.id),
			);
		},
		find,
		findByBarcode(barcode) {
			return this.list().find((food) => food.provenance.barcode === barcode);
		},
		search(query, locale, filter) {
			const matches = new Set([
				...legacy.search(query, locale, filter).map((food) => food.id),
				...account.search(query, locale, filter).map((food) => food.id),
			]);
			return this.list(filter).filter((food) => matches.has(food.id));
		},
		forks() {
			return this.list().filter(
				(food) => food.provenance.forkedFrom !== undefined,
			);
		},
		findForkOf(id) {
			return this.forks().find((food) => food.provenance.forkedFrom === id);
		},
		update: (id, draft) =>
			(account.find(id) ? account : legacy).update(id, draft),
		remove: (id) => (account.find(id) ? account : legacy).remove(id),
		listCombos() {
			const combos = new Map(
				legacy.listCombos().map((combo) => [combo.id, combo]),
			);
			for (const combo of account.listCombos()) combos.set(combo.id, combo);
			return [...combos.values()].map(resolveCombo);
		},
		findCombo(id) {
			const combo = account.findCombo(id) ?? legacy.findCombo(id);
			return combo ? resolveCombo(combo) : undefined;
		},
		createCombo: (draft, id) =>
			resolveCombo(
				(hasAccountFood(draft) ? account : legacy).createCombo(draft, id),
			),
		updateCombo(id, draft) {
			if (account.findCombo(id)) {
				const updated = account.updateCombo(id, draft);
				legacy.removeCombo(id);
				return resolveCombo(updated);
			}
			if (!hasAccountFood(draft))
				return resolveCombo(legacy.updateCombo(id, draft));
			if (!legacy.findCombo(id)) throw new Error("Combo not found.");
			// Commit the account copy before removing the shared copy. An interruption
			// can leave only the old shared snapshot, never the account food's data.
			const updated = account.createCombo(draft, id);
			legacy.removeCombo(id);
			return resolveCombo(updated);
		},
		removeCombo(id) {
			const removedAccount = account.removeCombo(id);
			const removedLegacy = legacy.removeCombo(id);
			return removedAccount || removedLegacy;
		},
		exportBackup() {
			return { foods: this.list(), combos: this.listCombos() };
		},
		replaceFromBackup(backup) {
			const accountFoodIds = new Set(account.list().map((food) => food.id));
			const accountComboIds = new Set(
				account.listCombos().map((combo) => combo.id),
			);
			account.replaceFromBackup({
				foods: backup.foods.filter((food) => accountFoodIds.has(food.id)),
				combos: backup.combos.filter((combo) => accountComboIds.has(combo.id)),
			});
			legacy.replaceFromBackup({
				foods: backup.foods.filter((food) => !accountFoodIds.has(food.id)),
				combos: backup.combos.filter((combo) => !accountComboIds.has(combo.id)),
			});
		},
	};
}
