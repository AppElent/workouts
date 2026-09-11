import { beforeEach, describe, expect, test } from "vitest";
import { shippedLibrary } from "./library";
import {
	browsePromotedByCategory,
	normaliseForSearch,
	resetSearchIndex,
	searchShippedFoods,
} from "./search";

function ids(
	query: string,
	options?: Parameters<typeof searchShippedFoods>[1],
): string[] {
	return searchShippedFoods(query, options).map((result) => result.food.id);
}

beforeEach(() => {
	resetSearchIndex();
});

describe("ordinary search", () => {
	test("returns the promoted food, not the technical NEVO rows around it", () => {
		const results = ids("banana");
		expect(results[0]).toBe("shipped:banana");
		expect(results.every((id) => shippedLibrary().byId.get(id)?.promoted)).toBe(
			true,
		);
	});

	test("finds the same food from either language", () => {
		expect(ids("banaan", { locale: "nl" })[0]).toBe("shipped:banana");
		expect(ids("banana", { locale: "en" })[0]).toBe("shipped:banana");
	});

	test("does not surface a raw catalogue row for an everyday word", () => {
		// "Banana bread" is a real NEVO row and is not promoted.
		expect(ids("banana")).not.toContain("shipped:banana-bread");
	});

	test("keeps the whole raw catalogue out of the ordinary tier", () => {
		expect(ids("mutton")).toEqual([]);
		expect(ids("chop-suey")).toEqual([]);
	});
});

describe("search all", () => {
	test("reaches every shipped row", () => {
		const results = ids("mutton", { scope: "all" });
		expect(results.length).toBeGreaterThan(0);
	});

	test("still puts promoted foods ahead of raw rows", () => {
		const results = searchShippedFoods("banana", { scope: "all" });
		expect(results[0]?.food.id).toBe("shipped:banana");
		const firstRaw = results.findIndex((result) => !result.food.promoted);
		expect(firstRaw).toBeGreaterThan(0);
		expect(
			results.some((result) => result.food.id === "shipped:banana-bread"),
		).toBe(true);
	});

	test("shows a raw row under its verbatim NEVO name", () => {
		const result = searchShippedFoods("chop-suey", { scope: "all" })[0];
		expect(result?.food.name.en).toBe(result?.food.sourceName.en);
		expect(result?.food.name.en).toContain("Chop-suey");
	});
});

describe("aliases", () => {
	test("pools the English aliases the overlay adds", () => {
		expect(ids("yogurt")).toContain("shipped:yoghurt-low-fat");
		expect(ids("zucchini")).toContain("shipped:courgettes-raw");
	});

	test("uses NEVO's own Dutch synonyms as search terms", () => {
		// NEVO's Synoniem column, not something the overlay authored.
		const juice = searchShippedFoods("jus d'orange", {
			locale: "nl",
			scope: "all",
		})[0];
		expect(juice?.food.code).toBe(410);
	});

	test("lets a familiar term in one language find a food named in the other", () => {
		expect(ids("hagelslag", { locale: "en" })).toContain(
			"shipped:chocolate-sprinkles-av",
		);
		expect(ids("stamppot", { locale: "en" }).length).toBeGreaterThan(0);
	});

	test("says which text matched, so a hit can be explained", () => {
		const result = searchShippedFoods("yogurt")[0];
		expect(result?.matched).toBe("alias");
		expect(result?.matchedText).toBe("yogurt");
	});
});

describe("matching", () => {
	test("ignores accents and punctuation", () => {
		expect(normaliseForSearch("Hüttenkäse")).toBe("huttenkase");
		expect(normaliseForSearch("Jus d'orange")).toBe("jus d orange");
		expect(ids("huttenkase")).toContain("shipped:cheese-cottage");
		expect(ids("Knäckebröd", { locale: "nl" })).toContain(
			"shipped:crispbread-av",
		);
	});

	test("ranks a whole-name match above a match in the middle of a name", () => {
		const results = ids("apple");
		expect(results[0]).toBe("shipped:apple-w-skin-av");
	});

	test("matches on every word when a query has several", () => {
		expect(ids("greek yoghurt")).toContain("shipped:yoghurt-greek-full-fat");
	});

	test("honours the limit", () => {
		expect(searchShippedFoods("e", { scope: "all", limit: 5 })).toHaveLength(5);
	});
});

describe("browsing", () => {
	test("an empty query lists the promoted foods rather than nothing", () => {
		const results = searchShippedFoods("", { limit: 500 });
		expect(results).toHaveLength(shippedLibrary().promoted.length);
	});

	test("an empty query does not dump the whole catalogue in search-all", () => {
		expect(searchShippedFoods("", { scope: "all" })).toEqual([]);
	});

	test("lists a category's promoted foods in name order", () => {
		const drinks = browsePromotedByCategory("drinks", "en");
		expect(drinks.length).toBeGreaterThan(0);
		expect(drinks.every((entry) => entry.category === "drinks")).toBe(true);
		const names = drinks.map((entry) => entry.name.en);
		expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
	});
});

describe("retired foods", () => {
	test("stay out of search results", () => {
		const library = shippedLibrary();
		expect(library.active.every((entry) => !entry.retired)).toBe(true);
		expect(library.promoted.every((entry) => !entry.retired)).toBe(true);
	});
});
