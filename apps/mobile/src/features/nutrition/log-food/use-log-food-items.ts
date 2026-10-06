import {
	type FoodResult,
	foodResults,
	getShippedFood,
} from "@workouts/core/nutrition";
import { useMemo } from "react";
import type {
	Combo,
	PersonalFood,
} from "../../../data/personal-food-repository";
import type { usePersonalFoods } from "../../../data/personal-foods";
import type { Messages } from "../../../i18n";
import { resultCaption } from "./log-food-captions";
import type { LogFoodCopy } from "./log-food-copy";
import type { FoodFilter, FoodSelection } from "./log-food-selection";

/**
 * The shipped side is capped, not paged: the list is virtualized, and the cap
 * exists only so an empty-query browse of the broader view has an end.
 */
const CATALOGUE_LIMIT = 2328;

export type LogFoodItem =
	| {
			readonly kind: "food";
			readonly selection: FoodSelection;
			readonly caption: string;
	  }
	| { readonly kind: "combo"; readonly combo: Combo };

/** The identity a row keeps across the tiers it can appear in. */
export function logFoodItemKey(item: LogFoodItem): string {
	return item.kind === "food"
		? `food:${item.selection.kind}:${item.selection.food.id}`
		: `combo:${item.combo.id}`;
}

function asSelection(result: FoodResult<PersonalFood>): FoodSelection {
	return result.kind === "local"
		? { kind: "personal", food: result.food }
		: { kind: "shipped", food: result.food };
}

/**
 * First occurrence wins.
 *
 * The pooled list is built tier by tier, so a food that is both recent and a
 * favorite — or recent and a search hit — arrives more than once. Keeping the
 * first keeps the tier order meaningful: what you logged yesterday stays above
 * the catalogue rather than being pulled down to where the catalogue found it.
 */
function dedupeItems(items: readonly LogFoodItem[]): LogFoodItem[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const key = logFoodItemKey(item);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** Resolves durable shortcut keys back to the foods they point at. */
function useShortcutSelections(
	shortcuts: readonly { readonly sourceKey: string }[],
	personalFoods: ReturnType<typeof usePersonalFoods>,
): FoodSelection[] {
	return useMemo(
		() =>
			shortcuts.reduce<FoodSelection[]>((selections, shortcut) => {
				const separator = shortcut.sourceKey.indexOf(":");
				const kind = shortcut.sourceKey.slice(0, separator);
				const id = shortcut.sourceKey.slice(separator + 1);
				if (kind === "shipped") {
					const food = getShippedFood(id);
					if (food) selections.push({ kind: "shipped", food });
					return selections;
				}
				if (kind === "personal") {
					const food = personalFoods.find(id);
					if (food) selections.push({ kind: "personal", food });
					return selections;
				}
				return selections;
			}, []),
		[personalFoods, shortcuts],
	);
}

/**
 * What the local list shows.
 *
 * `pool` is the default: one list holding recents, favorites, Combos, recipes
 * and ordinary search at once, so a food you own is never invisible because
 * you are standing on the wrong chip. The other chips narrow that same pool,
 * except `all` — the deliberate broader view (#75), the one place a shipped
 * record someone has corrected is still listed. Open Food Facts is never part
 * of this list; it is its own section below it.
 */
export function useLogFoodItems({
	query,
	filter,
	locale,
	personalFoods,
	recentShortcuts,
	favoriteShortcuts,
	messages,
	copy,
}: {
	query: string;
	filter: FoodFilter;
	locale: "en" | "nl";
	personalFoods: ReturnType<typeof usePersonalFoods>;
	recentShortcuts: readonly { readonly sourceKey: string }[];
	favoriteShortcuts: readonly { readonly sourceKey: string }[];
	messages: Messages["nutrition"];
	copy: LogFoodCopy;
}): readonly LogFoodItem[] {
	/**
	 * `promoted` is a curated everyday subset, not "the ordinary ranking" —
	 * which is exactly why a food you own could be invisible on the wrong tab.
	 * Both the pool and the broader view therefore search `all`; what separates
	 * them is that only the broader view keeps shipped records someone has
	 * corrected. Ranking and shadowing both live in core (#75).
	 */
	const broaderView = filter === "all";
	const allResults = useMemo(
		() =>
			foodResults<PersonalFood>({
				query,
				locale,
				scope: "all",
				localMatches: personalFoods.search(query, locale),
				localFoods: personalFoods.forks(),
				limit: CATALOGUE_LIMIT,
			}),
		[locale, personalFoods, query],
	);
	const recentSelections = useShortcutSelections(
		recentShortcuts,
		personalFoods,
	);
	const favoriteSelections = useShortcutSelections(
		favoriteShortcuts,
		personalFoods,
	);
	const combos = personalFoods.listCombos();
	const recipes = personalFoods.search(query, locale, {
		classification: "recipe",
	});
	return useMemo<readonly LogFoodItem[]>(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase();
		const matches = (name: string) =>
			!normalizedQuery || name.toLocaleLowerCase().includes(normalizedQuery);
		const shortcutItems = (
			selections: readonly FoodSelection[],
			caption: string,
		) =>
			selections
				.filter((selection) => matches(selection.food.name[locale]))
				.map((selection) => ({
					kind: "food" as const,
					selection,
					caption,
				}));
		const recentItems = shortcutItems(recentSelections, copy.recent);
		const favoriteItems = shortcutItems(favoriteSelections, copy.favoriteTag);
		const comboItems = combos
			.filter((combo) => matches(combo.name))
			.map((combo) => ({ kind: "combo" as const, combo }));
		const recipeItems = recipes.map((food) => ({
			kind: "food" as const,
			selection: { kind: "personal" as const, food },
			caption: copy.recipeTag,
		}));
		const searchItems = allResults
			// The pool is ordinary search: a shipped record whose correction is
			// already in the list would be a duplicate of it.
			.filter(
				(result) =>
					broaderView || result.kind === "local" || !result.shadowedBy,
			)
			// An empty query in the pool shows what you already keep rather than
			// the whole catalogue in alphabetical order; that browse is the
			// broader view's job.
			.filter(
				(result) =>
					broaderView || normalizedQuery.length > 0 || result.kind === "local",
			)
			.map((result) => ({
				kind: "food" as const,
				selection: asSelection(result),
				caption: resultCaption(result, messages, locale, {
					shipped: copy.sourceShipped,
					own: copy.sourceOwn,
				}),
			}));
		switch (filter) {
			case "recent":
				return recentItems;
			case "favorites":
				return favoriteItems;
			case "combos":
				return comboItems;
			case "recipes":
				return recipeItems;
			case "all":
				return searchItems;
			default:
				return dedupeItems([
					...recentItems,
					...favoriteItems,
					...comboItems,
					...recipeItems,
					...searchItems,
				]);
		}
	}, [
		allResults,
		broaderView,
		combos,
		copy,
		favoriteSelections,
		filter,
		locale,
		messages,
		query,
		recentSelections,
		recipes,
	]);
}
