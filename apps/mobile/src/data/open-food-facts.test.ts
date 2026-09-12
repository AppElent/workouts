import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import {
	type FetchLike,
	lookupOffBarcode,
	searchOffProducts,
} from "./open-food-facts";
import { createOpenFoodFactsCache } from "./personal-food-repository";

function jsonResponse(status: number, body: unknown) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	};
}

function fakeFetch(
	impl: (
		url: string,
	) => ReturnType<FetchLike> | ReturnType<typeof jsonResponse>,
): jest.Mock {
	return jest.fn(async (url: string) => impl(url));
}

const bakedBeans = {
	code: "5000112637922",
	product_name: "Baked Beans",
	product_name_en: "Baked Beans",
	product_name_nl: "Witte bonen in tomatensaus",
	nutriments: {
		"energy-kcal_100g": 75,
		proteins_100g: 4.8,
		carbohydrates_100g: 13,
		fat_100g: 0.2,
		"saturated-fat_100g": 0.1,
		fiber_100g: 3.7,
		sugars_100g: 5,
		salt_100g: 0.9,
	},
};

describe("lookupOffBarcode", () => {
	it("checks the cache before the network and maps a found product", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl = fakeFetch(() =>
			jsonResponse(200, { status: 1, product: bakedBeans }),
		);

		const first = await lookupOffBarcode("5000112637922", { cache, fetchImpl });
		expect(first).toMatchObject({ kind: "found", fromCache: false });
		if (first.kind !== "found") throw new Error("expected found");
		expect(first.draft).toMatchObject({
			name: { en: "Baked Beans", nl: "Witte bonen in tomatensaus" },
			baseUnit: "g",
			nutrients: {
				energy: { kind: "value", amount: 75 },
				protein: { kind: "value", amount: 4.8 },
			},
			provenance: {
				recordOrigin: "import",
				nutritionSource: "openfoodfacts",
				locallyEdited: false,
				provider: "Open Food Facts",
				barcode: "5000112637922",
			},
		});
		expect(first.draft.provenance.attribution).toMatch(/Open Food Facts/);

		const second = await lookupOffBarcode("5000112637922", {
			cache,
			fetchImpl,
		});
		expect(second).toMatchObject({ kind: "found", fromCache: true });
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("derives salt from sodium when the product has no direct salt figure", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl = fakeFetch(() =>
			jsonResponse(200, {
				status: 1,
				product: {
					...bakedBeans,
					nutriments: {
						...bakedBeans.nutriments,
						salt_100g: undefined,
						sodium_100g: 0.36,
					},
				},
			}),
		);
		const outcome = await lookupOffBarcode("5000112637922", {
			cache,
			fetchImpl,
		});
		if (outcome.kind !== "found") throw new Error("expected found");
		expect(outcome.draft.nutrients.salt).toEqual({
			kind: "value",
			amount: 0.9,
		});
	});

	it("reports an unknown barcode as not-found without caching it", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl = fakeFetch(() => jsonResponse(200, { status: 0 }));
		const outcome = await lookupOffBarcode("0000000000000", {
			cache,
			fetchImpl,
		});
		expect(outcome).toEqual({ kind: "not-found" });
		expect(cache.get("barcode:0000000000000")).toBeUndefined();
	});

	it("reports a 429 as rate-limited", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl = fakeFetch(() => jsonResponse(429, {}));
		expect(await lookupOffBarcode("123", { cache, fetchImpl })).toEqual({
			kind: "rate-limited",
		});
	});

	it("reports an aborted request as a timeout", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl: FetchLike = jest.fn(async (_url, init) => {
			return new Promise((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => {
					const error = new Error("aborted");
					error.name = "AbortError";
					reject(error);
				});
			});
		});
		const outcome = await lookupOffBarcode("123", {
			cache,
			fetchImpl,
			timeoutMs: 5,
		});
		expect(outcome).toEqual({ kind: "timeout" });
	});

	it("reports a network failure distinctly from a timeout", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl: FetchLike = jest.fn(async () => {
			throw new Error("offline");
		});
		expect(await lookupOffBarcode("123", { cache, fetchImpl })).toEqual({
			kind: "network-error",
		});
	});

	it("reports a product with no usable nutrients as incomplete", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl = fakeFetch(() =>
			jsonResponse(200, {
				status: 1,
				product: { code: "123", product_name: "Mystery Item", nutriments: {} },
			}),
		);
		expect(await lookupOffBarcode("123", { cache, fetchImpl })).toEqual({
			kind: "incomplete",
		});
	});

	it("reports a product with no usable name as invalid", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl = fakeFetch(() =>
			jsonResponse(200, {
				status: 1,
				product: { code: "123", nutriments: { "energy-kcal_100g": 100 } },
			}),
		);
		expect(await lookupOffBarcode("123", { cache, fetchImpl })).toEqual({
			kind: "invalid",
		});
	});
});

describe("searchOffProducts", () => {
	it("uses public Search-a-licious and maps its hits without credentials", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl = fakeFetch((url) => {
			const request = new URL(url);
			expect(request.origin + request.pathname).toBe(
				"https://search.openfoodfacts.org/search",
			);
			expect(request.searchParams.get("q")).toBe("hagelslag");
			expect(request.searchParams.get("langs")).toBe("nl,en");
			expect(request.searchParams.get("fields")).toContain("nutriments");
			return jsonResponse(200, {
				hits: [
					{
						code: "8710400002970",
						product_name: "Puur Hagelslag",
						brands: ["Albert Heijn"],
						nutriments: { "energy-kj_100g": 1835, proteins_100g: 5 },
					},
				],
				timed_out: false,
			});
		});
		const result = await searchOffProducts("hagelslag", { cache, fetchImpl });
		expect(result).toMatchObject({
			kind: "found",
			drafts: [
				{
					name: { nl: "Puur Hagelslag" },
					nutrients: { energy: { kind: "value", amount: 438.6 } },
					provenance: { barcode: "8710400002970" },
				},
			],
		});
	});
	it.each([
		{ errors: [{ title: "Invalid query" }] },
		{},
		{ hits: null },
	])("does not cache an invalid response as no matches: %j", async (body) => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl = fakeFetch(() => jsonResponse(200, body));
		expect(await searchOffProducts("beans", { cache, fetchImpl })).toEqual({
			kind: "unavailable",
		});
		expect(await searchOffProducts("beans", { cache, fetchImpl })).toEqual({
			kind: "unavailable",
		});
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});
	it("reports a provider-side timeout rather than caching partial results", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl = fakeFetch(() =>
			jsonResponse(200, { hits: [], timed_out: true }),
		);
		expect(await searchOffProducts("beans", { cache, fetchImpl })).toEqual({
			kind: "timeout",
		});
	});
	it("reports provider downtime without parsing HTML or caching the failure", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const json = jest.fn(async () => {
			throw new SyntaxError("HTML");
		});
		const fetchImpl = jest
			.fn()
			.mockResolvedValueOnce({ ok: false, status: 503, json })
			.mockResolvedValueOnce(jsonResponse(200, { hits: [bakedBeans] }));
		expect(await searchOffProducts("beans", { cache, fetchImpl })).toEqual({
			kind: "unavailable",
		});
		expect(json).not.toHaveBeenCalled();
		expect(
			await searchOffProducts("beans", { cache, fetchImpl }),
		).toMatchObject({ kind: "found" });
	});
	it("maps multiple results and reuses the cache on a repeat query", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl = fakeFetch(() =>
			jsonResponse(200, { hits: [bakedBeans] }),
		);

		const first = await searchOffProducts("baked beans", { cache, fetchImpl });
		expect(first).toMatchObject({ kind: "found", fromCache: false });
		if (first.kind !== "found") throw new Error("expected found");
		expect(first.drafts).toHaveLength(1);

		const second = await searchOffProducts("baked beans", { cache, fetchImpl });
		expect(second).toMatchObject({ kind: "found", fromCache: true });
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("treats an empty query as not-found without calling the network", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl = fakeFetch(() => jsonResponse(200, { hits: [] }));
		expect(await searchOffProducts("   ", { cache, fetchImpl })).toEqual({
			kind: "not-found",
		});
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("reports zero matches as not-found", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl = fakeFetch(() => jsonResponse(200, { hits: [] }));
		expect(
			await searchOffProducts("xyzzyunknown", { cache, fetchImpl }),
		).toEqual({
			kind: "not-found",
		});
	});

	it("reports a rate limit on search the same as on barcode lookup", async () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		const fetchImpl = fakeFetch(() => jsonResponse(429, {}));
		expect(await searchOffProducts("oats", { cache, fetchImpl })).toEqual({
			kind: "rate-limited",
		});
	});
});
