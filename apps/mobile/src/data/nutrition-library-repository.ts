import { registerLocalDatabase } from "../local-store/local-store";
import type { Combo, PersonalFood } from "./personal-food-repository";
import { portablePersonalFood } from "./personal-food-repository";

export type LibraryRecordKind = "food" | "combo";
export type LibraryRecord = {
	readonly subject?: string;
	readonly id: string;
	readonly kind: LibraryRecordKind;
	readonly payload: string | null;
	readonly schemaVersion?: 1 | 2 | 3;
	readonly revision: number;
	readonly deleted: boolean;
};

/** A safe, deterministic filename; account identifiers never become SQL or paths. */
export function nutritionLibraryDatabaseName(subject: string) {
	const encoded = Array.from(new TextEncoder().encode(subject), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
	return `workouts-nutrition-library-${encoded.slice(0, 160)}.db`;
}
registerLocalDatabase(/^workouts-nutrition-library-[0-9a-f]+\.db$/);

export function libraryRecordFromFood(
	food: PersonalFood,
	revision = 0,
): LibraryRecord {
	return {
		id: food.id,
		kind: "food",
		payload: JSON.stringify(portablePersonalFood(food)),
		revision,
		deleted: false,
	};
}

export function libraryRecordFromCombo(
	combo: Combo,
	revision = 0,
): LibraryRecord {
	return {
		id: combo.id,
		kind: "combo",
		payload: JSON.stringify(combo),
		revision,
		deleted: false,
	};
}
