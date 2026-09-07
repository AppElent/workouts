import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import {
	createOpenFoodFactsCache,
	createPersonalFoodRepository,
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

	it("shares its migration sequence and database with Personal Foods", () => {
		const database = new SQLiteTestDatabase();
		const personalFoods = createPersonalFoodRepository(database);
		const cache = createOpenFoodFactsCache(database);

		const created = personalFoods.create({
			name: { en: "Oat milk", nl: "Havermelk" },
			baseUnit: "ml",
			nutrients: {
				energy: { kind: "value", amount: 47 },
				protein: { kind: "value", amount: 1 },
				carbs: { kind: "value", amount: 6.6 },
				fat: { kind: "value", amount: 1.5 },
				saturatedFat: { kind: "value", amount: 0.2 },
				fibre: { kind: "value", amount: 0.8 },
				sugars: { kind: "value", amount: 4.1 },
				salt: { kind: "value", amount: 0.1 },
			},
			servings: [],
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
		});
		cache.set("barcode:1234", "barcode", { code: "1234" });

		expect(personalFoods.find(created.id)).toBeTruthy();
		expect(cache.get("barcode:1234")).toBeTruthy();
	});
});
