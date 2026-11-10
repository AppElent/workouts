import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import {
	createOpenFoodFactsCache,
	OFF_CACHE_MAX_ENTRIES,
	OFF_CACHE_TTL_MS,
} from "./personal-food-repository";

describe("OpenFoodFactsCache public behavior", () => {
	it("returns a cached response before expiry and nothing after", () => {
		let clock = 1_000;
		const database = new SQLiteTestDatabase();
		const cache = createOpenFoodFactsCache(database, { now: () => clock });

		cache.set("barcode:5000112637922", "barcode", { code: "5000112637922" });
		expect(cache.get("barcode:5000112637922")).toMatchObject({
			kind: "barcode",
			response: { code: "5000112637922" },
		});

		clock += OFF_CACHE_TTL_MS - 1;
		expect(cache.get("barcode:5000112637922")).toBeTruthy();

		clock += 2;
		expect(cache.get("barcode:5000112637922")).toBeUndefined();
	});

	it("misses for a request never cached", () => {
		const cache = createOpenFoodFactsCache(new SQLiteTestDatabase());
		expect(cache.get("search:oats")).toBeUndefined();
	});

	it("prunes expired rows and bounds the table to the newest entries", () => {
		let clock = 0;
		const database = new SQLiteTestDatabase();
		const cache = createOpenFoodFactsCache(database, { now: () => clock });

		cache.set("stale", "barcode", { stale: true });
		clock += OFF_CACHE_TTL_MS + 1;
		// A fresh write's own cleanup pass should sweep the row that expired
		// under it, not merely stop returning it from `get`.
		cache.set("fresh", "barcode", { fresh: true });
		expect(
			database.database
				.prepare("SELECT COUNT(*) as count FROM off_cache")
				.get(),
		).toEqual({ count: 1 });

		for (let index = 0; index < OFF_CACHE_MAX_ENTRIES + 5; index += 1) {
			cache.set(`entry-${index}`, "search", { index });
		}
		const { count } = database.database
			.prepare("SELECT COUNT(*) as count FROM off_cache")
			.get() as { count: number };
		expect(count).toBeLessThanOrEqual(OFF_CACHE_MAX_ENTRIES);
		// The oldest inserts are the ones pruned; the newest survives.
		expect(cache.get(`entry-${OFF_CACHE_MAX_ENTRIES + 4}`)).toBeTruthy();
		expect(cache.get("entry-0")).toBeUndefined();
	});
});
