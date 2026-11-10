import { describe, expect, test } from "vitest";
import {
	NEVO_ATTRIBUTION,
	NEVO_ATTRIBUTION_MIXED,
	nevoAttribution,
} from "./attribution";
import { SHIPPED_ARTIFACT, shippedLibrary, shippedSourceMeta } from "./library";
import { SHIPPED_NUTRIENT_KEYS } from "./nutrients";
import { shippedArtifactSchema } from "./schema";
import { FOOD_CATEGORIES, type ShippedFood } from "./types";

/**
 * The committed artifact is a build output, so these are contract tests on it:
 * would a reader of `@foundry/core/shipped-foods` get what it promises?
 */
describe("the committed shipped artifact", () => {
	test("validates against the schema it was generated under", () => {
		expect(() => shippedArtifactSchema.parse(SHIPPED_ARTIFACT)).not.toThrow();
	});

	test("ships Lidl products as promoted, salt-as-published foods", () => {
		const library = shippedLibrary();
		const lidl = library.foods.filter((food) => food.source === "lidl");
		expect(lidl.every((food) => food.id.startsWith("shipped:lidl-"))).toBe(
			true,
		);
		expect(lidl.every((food) => food.promoted)).toBe(true);
		expect(lidl.every((food) => food.servings.length === 1)).toBe(true);
		expect(lidl.every((food) => food.group === "lidl-bake-off")).toBe(true);
		expect(lidl.every((food) => food.nutrients.sodium.kind === "absent")).toBe(
			true,
		);
		expect(lidl.every((food) => food.nutrients.salt.kind === "value")).toBe(
			true,
		);
		expect(library.meta.sources.lidl?.saltDerived).toBe(false);
		expect(library.meta.sources.nevo.saltDerived).toBe(true);
		expect(shippedSourceMeta(lidl[0] as ShippedFood).name).toContain("Lidl");
		// Lidl codes never leak into the NEVO code index.
		for (const food of lidl)
			expect(library.byNevoCode.get(food.code)?.source ?? "nevo").toBe("nevo");
		const appelflap = library.byId.get("shipped:lidl-apple-turnover");
		expect(appelflap?.code).toBe(4056489847502);
		expect(appelflap?.servings[0]?.amount).toBe(105);
		expect(appelflap?.nutrients.energy).toEqual({ kind: "value", amount: 294 });
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
		// The raw NEVO file has rows with no fibre figure, rows reporting a
		// trace, and rows reporting a real, measured zero.
		expect(counts.absent).toBeGreaterThan(0);
		expect(counts.trace).toBeGreaterThan(0);
		expect(counts.zero).toBeGreaterThan(0);
	});

	test("files every food under one of the ten categories", () => {
		for (const food of shippedLibrary().foods) {
			expect(FOOD_CATEGORIES).toContain(food.category);
		}
	});

	test("maps every NEVO food group and the Lidl group to a category", () => {
		const groups = shippedLibrary().groups;
		expect(groups.some((group) => group.key === "lidl-bake-off")).toBe(true);
		for (const food of shippedLibrary().foods) {
			expect(groups.some((group) => group.key === food.group)).toBe(true);
		}
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
	});

	test("derives NEVO salt from sodium, keeping trace and absence", () => {
		for (const food of shippedLibrary().foods) {
			if (food.source !== "nevo") continue;
			const { salt, sodium } = food.nutrients;
			if (sodium.kind === "value" && salt.kind === "value")
				expect(salt.amount).toBeCloseTo((sodium.amount * 2.5) / 1000, 5);
			else expect(salt.kind).toBe(sodium.kind);
		}
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

	test("cites the dataset edition and publisher that were shipped", () => {
		const { edition, publisher } = SHIPPED_ARTIFACT.dataset;
		expect(NEVO_ATTRIBUTION).toContain(`version ${edition}, ${publisher}`);
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
