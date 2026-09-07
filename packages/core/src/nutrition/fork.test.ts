import { beforeEach, describe, expect, test } from "vitest";
import { decodeFood, type WireFood } from "./artifact";
import {
	type ForkedFoodDraft,
	foodResults,
	forkHasLocalEdits,
	forkShadows,
	forkShippedFood,
	forkSource,
	isFork,
	type LocalFoodLike,
} from "./fork";
import { getShippedFood, SHIPPED_ARTIFACT, shippedLibrary } from "./library";
import { resetSearchIndex } from "./search";
import type { ShippedFood } from "./types";

/** A device-local food, as the SQLite repository hands one back. */
type Local = LocalFoodLike & { readonly name: { en: string; nl: string } };

function local(id: string, name: string, forkedFrom?: string): Local {
	return {
		id,
		name: { en: name, nl: name },
		provenance: forkedFrom === undefined ? {} : { forkedFrom },
	};
}

function apple(): ShippedFood {
	const food = getShippedFood("shipped:apple-w-skin-av");
	if (!food) throw new Error("The overlay is expected to promote an apple.");
	return food;
}

function ids(results: ReturnType<typeof foodResults<Local>>): string[] {
	return results.map((result) => result.food.id);
}

beforeEach(() => {
	resetSearchIndex();
});

describe("forking a shipped food", () => {
	test("copies the shown name, base unit, servings and eight nutrients", () => {
		const source = apple();
		const draft = forkShippedFood(source);

		expect(draft.name).toEqual(source.name);
		expect(draft.baseUnit).toBe(source.baseUnit);
		expect(draft.nutrients.energy).toEqual(source.nutrients.energy);
		expect(draft.nutrients.salt).toEqual(source.nutrients.salt);
		expect(Object.keys(draft.nutrients).sort()).toEqual([
			"carbs",
			"energy",
			"fat",
			"fibre",
			"protein",
			"salt",
			"saturatedFat",
			"sugars",
		]);
		expect(draft.servings).toEqual(
			source.servings.map((serving) => ({
				label: serving.label,
				amount: serving.amount,
			})),
		);
	});

	test("records its source, its NEVO nutrition provenance and no edits yet", () => {
		const draft = forkShippedFood(apple());

		expect(draft.provenance).toEqual({
			recordOrigin: "personal",
			nutritionSource: "nevo",
			locallyEdited: false,
			forkedFrom: "shipped:apple-w-skin-av",
		});
	});

	test("preserves absent and trace rather than collapsing either to zero", () => {
		const source = shippedLibrary().active.find((food) =>
			Object.values(food.nutrients).some((value) => value.kind === "absent"),
		);
		if (!source)
			throw new Error("Expected a shipped food with an absent value.");

		const draft = forkShippedFood(source);

		for (const key of ["energy", "protein", "carbs", "salt"] as const) {
			expect(draft.nutrients[key].kind).toBe(source.nutrients[key].kind);
		}
	});

	test("names the shipped record behind a fork, and nothing behind a plain food", () => {
		const fork = local("fork-1", "My apple", "shipped:apple-w-skin-av");

		expect(isFork(fork)).toBe(true);
		expect(forkSource(fork)?.id).toBe("shipped:apple-w-skin-av");
		expect(isFork(local("own-1", "Training gel"))).toBe(false);
		expect(forkSource(local("own-1", "Training gel"))).toBeUndefined();
	});

	test("reports a withdrawn source as gone rather than as some other food", () => {
		const fork = local("fork-1", "My apple", "shipped:not-in-this-release");

		expect(isFork(fork)).toBe(true);
		expect(forkSource(fork)).toBeUndefined();
	});
});

describe("shadowing in ordinary search", () => {
	test("the fork replaces its source instead of sitting beside it", () => {
		const fork = local("fork-1", "Apple", "shipped:apple-w-skin-av");
		const results = foodResults({
			query: "apple",
			localMatches: [fork],
			localFoods: [fork],
		});

		expect(ids(results)).toContain("fork-1");
		expect(ids(results)).not.toContain("shipped:apple-w-skin-av");
	});

	test("a renamed fork still shadows the source it no longer resembles", () => {
		const fork = local(
			"fork-1",
			"Elstar from the market",
			"shipped:apple-w-skin-av",
		);
		const results = foodResults({
			query: "apple",
			// The fork's own name no longer matches, so it is not among the matches.
			localMatches: [],
			localFoods: [fork],
		});

		expect(ids(results)).not.toContain("shipped:apple-w-skin-av");
	});

	test("a Personal Food that is not a fork shadows nothing", () => {
		const own = local("own-1", "Apple purée");
		const results = foodResults({
			query: "apple",
			localMatches: [own],
			localFoods: [own],
		});

		expect(ids(results)).toContain("shipped:apple-w-skin-av");
	});

	test("local foods stay ahead of the shipped catalogue", () => {
		const fork = local("fork-1", "Apple", "shipped:apple-w-skin-av");
		const results = foodResults({
			query: "apple",
			localMatches: [fork],
			localFoods: [fork],
		});

		expect(results[0]).toMatchObject({ kind: "local", food: { id: "fork-1" } });
	});

	test("the fork carries the shipped record it stands in front of", () => {
		const fork = local("fork-1", "Apple", "shipped:apple-w-skin-av");
		const [first] = foodResults({
			query: "apple",
			localMatches: [fork],
			localFoods: [fork],
		});

		expect(first.kind).toBe("local");
		expect(first.kind === "local" && first.shadows?.sourceName.en).toBe(
			apple().sourceName.en,
		);
	});

	test("the most recently updated of two forks wins the shadow", () => {
		const newer = local("fork-new", "Apple v2", "shipped:apple-w-skin-av");
		const older = local("fork-old", "Apple v1", "shipped:apple-w-skin-av");

		// The repository lists most-recently-updated first.
		expect(forkShadows([newer, older]).get("shipped:apple-w-skin-av")?.id).toBe(
			"fork-new",
		);
	});
});

describe("the broader source view", () => {
	test("still lists the shipped original, flagged with the correction", () => {
		const fork = local("fork-1", "Apple", "shipped:apple-w-skin-av");
		const results = foodResults({
			query: "apple",
			scope: "all",
			localMatches: [fork],
			localFoods: [fork],
		});
		const original = results.find(
			(result) => result.food.id === "shipped:apple-w-skin-av",
		);

		expect(original).toBeDefined();
		expect(original?.kind === "shipped" && original.shadowedBy?.id).toBe(
			"fork-1",
		);
	});

	test("identifies the original by its published NEVO name", () => {
		const fork = local("fork-1", "Apple", "shipped:apple-w-skin-av");
		const results = foodResults({
			query: "apple",
			scope: "all",
			localMatches: [fork],
			localFoods: [fork],
		});
		const original = results.find(
			(result) => result.food.id === "shipped:apple-w-skin-av",
		);

		expect(
			original?.kind === "shipped" ? original.food.sourceName.en : undefined,
		).toBe(apple().sourceName.en);
	});

	test("browses the whole catalogue when nothing is typed", () => {
		const results = foodResults({
			query: "",
			scope: "all",
			localMatches: [],
			localFoods: [],
			limit: 25,
		});

		expect(results).toHaveLength(25);
		expect(results.every((result) => result.kind === "shipped")).toBe(true);
	});
});

describe("deleting a fork", () => {
	test("restores the shipped result to ordinary search", () => {
		const fork = local("fork-1", "Apple", "shipped:apple-w-skin-av");
		const withFork = foodResults({
			query: "apple",
			localMatches: [fork],
			localFoods: [fork],
		});
		// Deleting the fork is simply its absence from the repository's list.
		const afterDelete = foodResults({
			query: "apple",
			localMatches: [],
			localFoods: [],
		});

		expect(ids(withFork)).not.toContain("shipped:apple-w-skin-av");
		expect(ids(afterDelete)).toContain("shipped:apple-w-skin-av");
		expect(ids(afterDelete)).not.toContain("fork-1");
	});
});

describe("a later shipped correction", () => {
	/** The same food as a future release might publish it: energy corrected. */
	function correctedApple(): ShippedFood {
		const wire = SHIPPED_ARTIFACT.foods.find(
			(food) => food.id === "shipped:apple-w-skin-av",
		);
		if (!wire) throw new Error("Expected the apple in the artifact.");
		const energyIndex = SHIPPED_ARTIFACT.nutrientOrder.indexOf("energy");
		const nutrients = wire.n.slice();
		nutrients[energyIndex] = 999;
		return decodeFood({ ...wire, n: nutrients } as WireFood, [
			...SHIPPED_ARTIFACT.nutrientOrder,
		]);
	}

	test("cannot reach a fork taken before it", () => {
		const draft = forkShippedFood(apple());
		const corrected = correctedApple();

		expect(corrected.nutrients.energy).toEqual({
			kind: "value",
			amount: 999,
		});
		// The fork was copied once, at fork time. Nothing re-reads the source.
		expect(draft.nutrients.energy).toEqual(apple().nutrients.energy);
		expect(draft.nutrients.energy).not.toEqual(corrected.nutrients.energy);
	});

	test("leaves the fork's shadow of that source in place", () => {
		const fork = local("fork-1", "Apple", "shipped:apple-w-skin-av");
		const results = foodResults({
			query: "apple",
			localMatches: [fork],
			localFoods: [fork],
		});

		expect(ids(results)).not.toContain("shipped:apple-w-skin-av");
	});
});

describe("locally edited state", () => {
	function draftOf(source: ShippedFood): ForkedFoodDraft {
		return forkShippedFood(source);
	}

	test("an untouched fork has not been edited locally", () => {
		expect(forkHasLocalEdits(draftOf(apple()), apple())).toBe(false);
	});

	test.each([
		[
			"a corrected figure",
			(draft: ForkedFoodDraft): ForkedFoodDraft => ({
				...draft,
				nutrients: { ...draft.nutrients, energy: { kind: "value", amount: 1 } },
			}),
		],
		[
			"a renamed food",
			(draft: ForkedFoodDraft): ForkedFoodDraft => ({
				...draft,
				name: { en: "Elstar", nl: "Elstar" },
			}),
		],
		[
			"an absent figure replacing a value",
			(draft: ForkedFoodDraft): ForkedFoodDraft => ({
				...draft,
				nutrients: { ...draft.nutrients, energy: { kind: "absent" } },
			}),
		],
		[
			"a changed Serving",
			(draft: ForkedFoodDraft): ForkedFoodDraft => ({
				...draft,
				servings: [{ label: { en: "Half", nl: "Half" }, amount: 60 }],
			}),
		],
	])("%s counts as a local edit", (_case, change) => {
		expect(forkHasLocalEdits(change(draftOf(apple())), apple())).toBe(true);
	});

	test("a figure changed and changed back is not an edit", () => {
		const source = apple();
		const draft = draftOf(source);
		const changed: ForkedFoodDraft = {
			...draft,
			nutrients: { ...draft.nutrients, fat: { kind: "value", amount: 42 } },
		};
		const reverted: ForkedFoodDraft = {
			...changed,
			nutrients: { ...changed.nutrients, fat: source.nutrients.fat },
		};

		expect(forkHasLocalEdits(changed, source)).toBe(true);
		expect(forkHasLocalEdits(reverted, source)).toBe(false);
	});
});
