/**
 * Forking a shipped food, and shadowing its original in search.
 *
 * A shipped record is immutable at runtime (spec #68). Correcting one does not
 * edit it: it mints a *new* device-local food that remembers where it came
 * from, and that fork then stands in front of its source in ordinary results
 * so nobody logs the version they just corrected.
 *
 * Three properties this module exists to keep true:
 *
 *  1. **The original is always recoverable.** A fork stores `forkedFrom`, so
 *     {@link forkSource} can always name the shipped record behind it, and the
 *     broader "search all" view still lists that record — flagged, not hidden.
 *  2. **Shadowing is search-time only.** Nothing here rewrites, redirects or
 *     migrates anything. Diary snapshots and Combos are historical records and
 *     keep pointing wherever they already point; a fork changes what the *next*
 *     search returns and nothing else.
 *  3. **A later shipped correction never reaches the fork.** There is
 *     deliberately no sync, merge or notify path in this file, and there must
 *     not be one: the fork's figures are the user's, permanently and silently.
 *     {@link forkShippedFood} copies values out once, at fork time.
 */
import { getShippedFood, shippedLibrary } from "./library";
import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "./nutrients";
import { type SearchScope, searchShippedFoods } from "./search";
import type { Bilingual, Locale, ShippedFood, ShippedFoodId } from "./types";

/** A Personal Food carries at most three Servings, forks included. */
export const MAX_FORK_SERVINGS = 3;

export type ForkedServing = {
	readonly label: Bilingual;
	/** Amount in the fork's base unit. */
	readonly amount: number;
};

/**
 * What a fork records about where it came from.
 *
 * `recordOrigin` says the row is the user's own; `nutritionSource: "nevo"` says
 * the figures started as NEVO's, which is why NEVO attribution follows a fork
 * into its detail view and its diary snapshots; `locallyEdited` says whether
 * the user has actually changed anything yet. Conflating the three loses all
 * three answers, so they stay separate (spec #68, "Provenance and attribution").
 */
export type ForkProvenance = {
	readonly recordOrigin: "personal";
	readonly nutritionSource: "nevo";
	readonly locallyEdited: boolean;
	readonly forkedFrom: ShippedFoodId;
};

/**
 * The pre-populated Personal Food a correction starts from.
 *
 * Structurally a device `PersonalFoodDraft` — `@workouts/core` cannot import
 * the repository's types (it must stay dependency-free and platform-free), so
 * the two shapes meet structurally and the repository validates the result.
 */
export type ForkedFoodDraft = {
	readonly name: Bilingual;
	readonly baseUnit: "g" | "ml";
	readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	readonly servings: readonly ForkedServing[];
	readonly provenance: ForkProvenance;
};

/**
 * Copy a shipped food into a fresh, detached draft.
 *
 * Detached is the point: every figure is read out here and never read again.
 * The caller mints the new UUID (device concern), so nothing in the draft is
 * shared with, or derived at read time from, the shipped record.
 *
 * Sodium is deliberately dropped. It rides on shipped foods only so the derived
 * salt figure stays traceable to what NEVO published; a Personal Food has no
 * sodium field and no way to edit one, and salt — already derived — is carried
 * across in full.
 */
export function forkShippedFood(food: ShippedFood): ForkedFoodDraft {
	const nutrients = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS) {
		const value = food.nutrients[key];
		nutrients[key] =
			value.kind === "value" ? { kind: "value", amount: value.amount } : value;
	}
	return {
		name: { en: food.name.en, nl: food.name.nl },
		baseUnit: food.baseUnit,
		nutrients,
		servings: food.servings.slice(0, MAX_FORK_SERVINGS).map((serving) => ({
			label: { en: serving.label.en, nl: serving.label.nl },
			amount: serving.amount,
		})),
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "nevo",
			locallyEdited: false,
			forkedFrom: food.id,
		},
	};
}

/** The least a local food has to expose for shadowing to work. */
export type LocalFoodLike = {
	readonly id: string;
	readonly provenance: { readonly forkedFrom?: string };
};

/** Whether a local food was created by correcting a shipped one. */
export function isFork(food: LocalFoodLike): boolean {
	return typeof food.provenance.forkedFrom === "string";
}

/**
 * The shipped record a fork came from, if it is still in the library.
 *
 * `undefined` for a food that is not a fork, and for a fork whose source has
 * been withdrawn from a later release — ids are never reused, so a missing
 * source means gone, never "something else now".
 */
export function forkSource(food: LocalFoodLike): ShippedFood | undefined {
	const id = food.provenance.forkedFrom;
	return id === undefined ? undefined : getShippedFood(id);
}

/**
 * Which shipped ids are shadowed, and by which fork.
 *
 * When two forks claim the same source — nothing forbids correcting a food
 * twice — the first in the supplied order wins the shadow. Callers supply the
 * repository's own order, which is most-recently-updated first, so the fork the
 * user touched last is the one their search surfaces.
 */
export function forkShadows<L extends LocalFoodLike>(
	localFoods: readonly L[],
): Map<string, L> {
	const shadows = new Map<string, L>();
	for (const food of localFoods) {
		const source = food.provenance.forkedFrom;
		if (source !== undefined && !shadows.has(source)) shadows.set(source, food);
	}
	return shadows;
}

export type FoodResult<L extends LocalFoodLike> =
	| {
			readonly kind: "local";
			readonly food: L;
			/** Set when this local food is a fork whose source is still shipped. */
			readonly shadows?: ShippedFood;
	  }
	| {
			readonly kind: "shipped";
			readonly food: ShippedFood;
			/**
			 * Set only in the broader view: this shipped record has been corrected,
			 * and here is the correction. Ordinary search never returns this — the
			 * row is gone from it entirely.
			 */
			readonly shadowedBy?: L;
	  };

export type FoodResultsInput<L extends LocalFoodLike> = {
	readonly query: string;
	readonly locale?: Locale;
	/**
	 * `promoted` is ordinary search and shadows. `all` is the deliberate broader
	 * view: it keeps every shipped row reachable and flags the shadowed ones, so
	 * a corrected original can still be found, read and logged on purpose.
	 */
	readonly scope?: SearchScope;
	/** Local foods matching the query, in the order the repository ranked them. */
	readonly localMatches: readonly L[];
	/**
	 * Every local food, not just the matches. A fork that was renamed away from
	 * its source's name must still shadow that source — otherwise correcting
	 * "Apple" to "Elstar apple" would put the uncorrected Apple back in front of
	 * the person who corrected it.
	 */
	readonly localFoods: readonly L[];
	/** Cap on the shipped side only; local matches are already bounded. */
	readonly limit?: number;
};

/**
 * The ordinary find-food result list: local foods first, then shipped ones,
 * with forks standing in front of the records they correct.
 *
 * Local foods lead because a person's own foods and corrections are what they
 * meant (spec #68, "Find and log food"); shipped ranking inside the tail is
 * whatever `searchShippedFoods` decided.
 */
export function foodResults<L extends LocalFoodLike>(
	input: FoodResultsInput<L>,
): FoodResult<L>[] {
	const locale = input.locale ?? "en";
	const scope = input.scope ?? "promoted";
	const shadows = forkShadows(input.localFoods);

	const results: FoodResult<L>[] = input.localMatches.map((food) => {
		const source = forkSource(food);
		return source
			? { kind: "local" as const, food, shadows: source }
			: { kind: "local" as const, food };
	});

	for (const food of shippedCandidates(
		input.query,
		locale,
		scope,
		input.limit,
	)) {
		const shadowedBy = shadows.get(food.id);
		// Ordinary search drops the corrected original outright; the broader view
		// keeps it and says who corrected it.
		if (shadowedBy && scope === "promoted") continue;
		results.push(
			shadowedBy
				? { kind: "shipped", food, shadowedBy }
				: { kind: "shipped", food },
		);
	}

	return results;
}

/**
 * The shipped rows a query reaches, before shadowing.
 *
 * An empty query in the broader view is a browse of the whole catalogue rather
 * than a search, which `searchShippedFoods` deliberately refuses to answer.
 */
function shippedCandidates(
	query: string,
	locale: Locale,
	scope: SearchScope,
	limit: number | undefined,
): ShippedFood[] {
	if (scope === "all" && query.trim().length === 0) {
		const all = shippedLibrary()
			.active.slice()
			.sort((a, b) => a.sourceName[locale].localeCompare(b.sourceName[locale]));
		return limit === undefined ? all : all.slice(0, limit);
	}
	return searchShippedFoods(query, {
		locale,
		scope,
		...(limit === undefined ? {} : { limit }),
	}).map((result) => result.food);
}

/**
 * Whether a fork's draft still says exactly what its source said.
 *
 * This is what `locallyEdited` answers, and it is recomputed on every save
 * rather than latched: a person who forks a food, changes a figure, then
 * changes it back has not, in the end, edited anything.
 */
export function forkHasLocalEdits(
	draft: ForkedFoodDraft,
	source: ShippedFood,
): boolean {
	if (draft.name.en !== source.name.en || draft.name.nl !== source.name.nl)
		return true;
	if (draft.baseUnit !== source.baseUnit) return true;
	for (const key of NUTRIENT_KEYS) {
		if (!sameNutrient(draft.nutrients[key], source.nutrients[key])) return true;
	}
	const sourceServings = source.servings.slice(0, MAX_FORK_SERVINGS);
	if (draft.servings.length !== sourceServings.length) return true;
	for (let index = 0; index < draft.servings.length; index += 1) {
		const mine = draft.servings[index];
		const theirs = sourceServings[index];
		if (
			mine.label.en !== theirs.label.en ||
			mine.label.nl !== theirs.label.nl ||
			mine.amount !== theirs.amount
		)
			return true;
	}
	return false;
}

function sameNutrient(left: NutrientValue, right: NutrientValue): boolean {
	if (left.kind !== right.kind) return false;
	return left.kind !== "value" || right.kind !== "value"
		? true
		: left.amount === right.amount;
}
