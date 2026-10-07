import type { PersonalFood } from "@workouts/core/nutrition";
import {
	comboSourceKey,
	foodSourceKey,
} from "../../../data/nutrition-shortcuts";
import type { Combo } from "../../../data/personal-food-repository";

export type LibraryKind = "food" | "recipe" | "combo";
export type LibraryChip = "all" | LibraryKind | "favorite";

export type LibraryItem =
	| {
			readonly kind: "food" | "recipe";
			readonly id: string;
			readonly food: PersonalFood;
			readonly favorite: boolean;
	  }
	| {
			readonly kind: "combo";
			readonly id: string;
			readonly combo: Combo;
			readonly favorite: boolean;
	  };

export const LIBRARY_KINDS: readonly LibraryKind[] = [
	"food",
	"recipe",
	"combo",
];

/** Every item the library lists, foods and recipes by name, combos last. */
export function libraryItems(
	foods: readonly PersonalFood[],
	combos: readonly Combo[],
	favoriteKeys: ReadonlySet<string>,
): LibraryItem[] {
	return [
		...foods.map(
			(food): LibraryItem => ({
				kind: food.classification === "recipe" ? "recipe" : "food",
				id: food.id,
				food,
				favorite: favoriteKeys.has(foodSourceKey("personal", food.id)),
			}),
		),
		...combos.map(
			(combo): LibraryItem => ({
				kind: "combo",
				id: combo.id,
				combo,
				favorite: favoriteKeys.has(comboSourceKey(combo.id)),
			}),
		),
	];
}

/** The shortcut key a library item is a favourite under. */
export function favoriteKeyOf(item: LibraryItem): string {
	return item.kind === "combo"
		? comboSourceKey(item.id)
		: foodSourceKey("personal", item.id);
}

export function libraryItemName(item: LibraryItem, locale: "en" | "nl") {
	return item.kind === "combo" ? item.combo.name : item.food.name[locale];
}

function normalize(text: string) {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

function haystack(item: LibraryItem): string {
	if (item.kind === "combo")
		return normalize(
			[
				item.combo.name,
				...item.combo.parts.flatMap((part) => [
					part.snapshot.name.en,
					part.snapshot.name.nl,
				]),
			].join(" "),
		);
	const { food } = item;
	return normalize(
		[
			food.name.en,
			food.name.nl,
			food.provenance.brand ?? "",
			food.provenance.barcode ?? "",
		].join(" "),
	);
}

/** Local filtering only: the library never asks a provider while typing. */
export function filterLibrary(
	items: readonly LibraryItem[],
	{
		chip,
		query,
		locale,
	}: { chip: LibraryChip; query: string; locale: "en" | "nl" },
): LibraryItem[] {
	const term = normalize(query.trim());
	return items
		.filter((item) =>
			chip === "all"
				? true
				: chip === "favorite"
					? item.favorite
					: item.kind === chip,
		)
		.filter((item) => !term || haystack(item).includes(term))
		.sort(
			(a, b) =>
				LIBRARY_KINDS.indexOf(a.kind) - LIBRARY_KINDS.indexOf(b.kind) ||
				libraryItemName(a, locale).localeCompare(libraryItemName(b, locale)),
		);
}

/** One section per kind, in a fixed order; empty kinds are kept for their hint. */
export function librarySections(items: readonly LibraryItem[]) {
	return LIBRARY_KINDS.map((kind) => ({
		kind,
		items: items.filter((item) => item.kind === kind),
	}));
}

/** The combos a food is part of, named when it is about to be deleted. */
export function combosUsing(foodId: string, combos: readonly Combo[]): Combo[] {
	return combos.filter((combo) =>
		combo.parts.some(
			(part) =>
				part.reference.kind === "personal" && part.reference.foodId === foodId,
		),
	);
}
