import { describe, expect, test } from "vitest";
import { GROUP_CATEGORIES } from "../../scripts/build";
import {
	NEVO_ATTRIBUTION,
	NEVO_ATTRIBUTION_MIXED,
	nevoAttribution,
} from "./attribution";
import { SHIPPED_ARTIFACT, shippedLibrary } from "./library";
import { SHIPPED_NUTRIENT_KEYS } from "./nutrients";
import { shippedArtifactSchema } from "./schema";
import { FOOD_CATEGORIES } from "./types";

/**
 * The committed artifact is a build output, so these are contract tests on it:
 * would a reader of `@workouts/core/nutrition` get what the spec promises?
 */
describe("the committed shipped artifact", () => {
	test("validates against the schema it was generated under", () => {
		expect(() => shippedArtifactSchema.parse(SHIPPED_ARTIFACT)).not.toThrow();
	});

	test("carries all 2,328 NEVO rows", () => {
		expect(shippedLibrary().foods).toHaveLength(2328);
	});

	test("gives every food a permanent shipped: id, used once", () => {
		const ids = shippedLibrary().foods.map((food) => food.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.every((id) => id.startsWith("shipped:"))).toBe(true);
	});

	test("keeps the NEVO code as source identity, never as the id", () => {
		const banana = shippedLibrary().byId.get("shipped:banana");
		expect(banana?.code).toBe(151);
		// Same food reachable by code, but the id is what a reference stores.
		expect(shippedLibrary().byNevoCode.get(151)?.id).toBe("shipped:banana");
	});

	test("names every food in both languages", () => {
		for (const food of shippedLibrary().foods) {
			expect(food.name.en.length).toBeGreaterThan(0);
			expect(food.name.nl.length).toBeGreaterThan(0);
			expect(food.sourceName.en.length).toBeGreaterThan(0);
			expect(food.sourceName.nl.length).toBeGreaterThan(0);
		}
	});

	test("shows the NEVO name verbatim even where a friendlier name exists", () => {
		const banana = shippedLibrary().byId.get("shipped:banana");
		expect(banana?.name.nl).toBe("Banaan");
		expect(banana?.sourceName.en).toBe("Banana");
		const bread = shippedLibrary().byId.get("shipped:wheat-bread-brown");
		expect(bread?.name.en).toBe("Brown bread");
		expect(bread?.sourceName.en).toBe("Wheat bread brown");
	});

	test("presents all eight nutrients plus source sodium on every food", () => {
		for (const food of shippedLibrary().foods.slice(0, 200)) {
			for (const key of SHIPPED_NUTRIENT_KEYS) {
				expect(food.nutrients[key]).toBeDefined();
				expect(["value", "trace", "absent"]).toContain(
					food.nutrients[key].kind,
				);
			}
		}
	});

	test("preserves absent, trace and zero as three different states", () => {
		const library = shippedLibrary();
		const counts = { absent: 0, trace: 0, zero: 0 };
		for (const food of library.foods) {
			const fibre = food.nutrients.fibre;
			if (fibre.kind === "absent") counts.absent += 1;
			else if (fibre.kind === "trace") counts.trace += 1;
			else if (fibre.amount === 0) counts.zero += 1;
		}
		// Measured against the raw NEVO file: 7 rows have no fibre figure at all,
		// 2 report a trace, and many report a real, measured zero.
		expect(counts.absent).toBe(7);
		expect(counts.trace).toBe(2);
		expect(counts.zero).toBeGreaterThan(100);
	});

	test("files every food under one of the ten categories", () => {
		for (const food of shippedLibrary().foods) {
			expect(FOOD_CATEGORIES).toContain(food.category);
		}
	});

	test("maps all 27 NEVO food groups", () => {
		const groups = shippedLibrary().groups;
		expect(groups).toHaveLength(27);
		expect(Object.keys(GROUP_CATEGORIES)).toHaveLength(27);
		for (const group of groups) {
			expect(FOOD_CATEGORIES).toContain(group.category);
			expect(group.name.nl.length).toBeGreaterThan(0);
		}
	});

	test("promotes foods in every one of the ten categories", () => {
		const promoted = shippedLibrary().promoted;
		const covered = new Set(promoted.map((food) => food.category));
		expect(
			[...FOOD_CATEGORIES].every((category) => covered.has(category)),
		).toBe(true);
		expect(promoted.length).toBeGreaterThanOrEqual(140);
	});

	test("gives every promoted food an emoji and a bilingual name", () => {
		for (const food of shippedLibrary().promoted) {
			expect(food.emoji).toBeTruthy();
			expect(food.name.en).not.toBe("");
			expect(food.name.nl).not.toBe("");
		}
	});

	test("never promotes a beverage without a practical serving", () => {
		const drinks = shippedLibrary().promoted.filter(
			(food) => food.category === "drinks",
		);
		expect(drinks.length).toBeGreaterThan(0);
		for (const drink of drinks) {
			expect(drink.servings.length).toBeGreaterThan(0);
		}
	});

	test("states how every volume-labelled serving became a mass", () => {
		for (const food of shippedLibrary().promoted) {
			for (const serving of food.servings) {
				if (serving.volumeMl === undefined) continue;
				expect(serving.basis).toBeDefined();
				if (serving.basis === "one-to-one") {
					// The documented water-like fallback, and only that.
					expect(serving.amount).toBe(serving.volumeMl);
				}
			}
		}
	});

	test("offers at most three authored servings", () => {
		for (const food of shippedLibrary().foods) {
			expect(food.servings.length).toBeLessThanOrEqual(3);
		}
	});

	test("declares salt as an Appelent addition derived from sodium", () => {
		expect(SHIPPED_ARTIFACT.derived.salt.from).toBe("sodium");
		expect(SHIPPED_ARTIFACT.derived.salt.origin).toBe("appelent-derived");
		expect(SHIPPED_ARTIFACT.derived.salt.formula).toContain("2.5");
	});

	test("carries the licence text the NEVO conditions require on output", () => {
		expect(SHIPPED_ARTIFACT.licence.attribution).toBe(NEVO_ATTRIBUTION);
		expect(SHIPPED_ARTIFACT.licence.attributionMixed).toBe(
			NEVO_ATTRIBUTION_MIXED,
		);
		expect(SHIPPED_ARTIFACT.licence.constraints.join(" ")).toMatch(
			/may not be charged/i,
		);
	});

	test("names the dataset and edition RIVM asks to be cited", () => {
		expect(SHIPPED_ARTIFACT.dataset.edition).toBe("2025/9.0");
		expect(SHIPPED_ARTIFACT.dataset.publisher).toBe("RIVM, Bilthoven");
	});
});

describe("attribution", () => {
	test("uses the plain reference when only shipped foods contributed", () => {
		expect(nevoAttribution(true)).toBe(
			"Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven",
		);
	});

	test("uses the '…and other data sources' variant once anything else did", () => {
		expect(nevoAttribution(false)).toMatch(/and other data sources$/);
	});
});
