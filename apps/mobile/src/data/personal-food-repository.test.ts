import {
	forkShippedFood,
	forkSource,
	getShippedFood,
	type NUTRIENT_KEYS,
	type NutrientValue,
} from "@workouts/core/nutrition";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import {
	createPersonalFoodRepository,
	type PersonalFoodDraft,
} from "./personal-food-repository";

function nutrientStates(): Record<
	(typeof NUTRIENT_KEYS)[number],
	NutrientValue
> {
	return {
		energy: { kind: "value", amount: 0 },
		protein: { kind: "trace" },
		carbs: { kind: "absent" },
		fat: { kind: "value", amount: 12.5 },
		saturatedFat: { kind: "absent" },
		fibre: { kind: "trace" },
		sugars: { kind: "value", amount: 3 },
		salt: { kind: "value", amount: 0.2 },
	};
}

function draft(overrides: Partial<PersonalFoodDraft> = {}): PersonalFoodDraft {
	return {
		name: { en: "Training oats", nl: "Trainingshavermout" },
		baseUnit: "g",
		nutrients: nutrientStates(),
		servings: [
			{ label: { en: "Scoop", nl: "Schep" }, amount: 30 },
			{ label: { en: "Bowl", nl: "Kom" }, amount: 75.5 },
			{ label: { en: "Large bowl", nl: "Grote kom" }, amount: 110 },
		],
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: false,
		},
		...overrides,
	};
}

/** Distinct, increasing timestamps so "most recent first" is unambiguous. */
function stepwiseClock(): () => number {
	let tick = 1_000;
	return () => {
		tick += 1_000;
		return tick;
	};
}

describe("PersonalFoodRepository public behavior", () => {
	it("mints a stable UUID and preserves zero, trace, absent, and three Servings", () => {
		const database = new SQLiteTestDatabase();
		const repository = createPersonalFoodRepository(database);

		const created = repository.create(draft());
		const found = repository.find(created.id);

		expect(created.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		expect(found).toEqual(created);
		expect(found?.nutrients.energy).toEqual({ kind: "value", amount: 0 });
		expect(found?.nutrients.protein).toEqual({ kind: "trace" });
		expect(found?.nutrients.carbs).toEqual({ kind: "absent" });
		expect(found?.servings).toHaveLength(3);
	});

	it.each([
		[
			"a fourth Serving",
			draft({
				servings: [
					...draft().servings,
					{ label: { en: "Fourth", nl: "Vierde" }, amount: 20 },
				],
			}),
			"up to three",
		],
		[
			"a non-positive Serving amount",
			draft({
				servings: [{ label: { en: "Scoop", nl: "Schep" }, amount: 0 }],
			}),
			"greater than zero",
		],
		[
			"a negative per-100 nutrient",
			draft({
				nutrients: {
					...nutrientStates(),
					protein: { kind: "value", amount: -1 },
				},
			}),
			"zero or greater",
		],
	] as const)("rejects %s", (_case, invalid, message) => {
		const repository = createPersonalFoodRepository(new SQLiteTestDatabase());
		expect(() => repository.create(invalid)).toThrow(message);
	});

	it("keeps an id through edits and persists across repository recreation", () => {
		const database = new SQLiteTestDatabase();
		const firstRepository = createPersonalFoodRepository(database);
		const created = firstRepository.create(draft());

		const edited = firstRepository.update(
			created.id,
			draft({ name: { en: "Workout oats", nl: "Workouthavermout" } }),
		);
		const recreatedRepository = createPersonalFoodRepository(database);

		expect(edited.id).toBe(created.id);
		expect(recreatedRepository.find(created.id)?.name).toEqual({
			en: "Workout oats",
			nl: "Workouthavermout",
		});
		expect(recreatedRepository.search("trainings", "en")).toEqual([]);
		expect(recreatedRepository.search("workouthaver", "en")).toEqual([
			expect.objectContaining({ id: created.id }),
		]);
	});

	it("removes lookup and search results without affecting copied values", () => {
		const repository = createPersonalFoodRepository(new SQLiteTestDatabase());
		const created = repository.create(draft());
		const copiedSnapshot = structuredClone(created.nutrients);

		expect(repository.remove(created.id)).toBe(true);
		expect(repository.find(created.id)).toBeUndefined();
		expect(repository.search("oats", "en")).toEqual([]);
		expect(copiedSnapshot).toEqual(nutrientStates());
		expect(repository.remove(created.id)).toBe(false);
	});

	it("opens an existing v1 database without rewriting its Personal Food", () => {
		const database = new SQLiteTestDatabase();
		database.execSync(`
			CREATE TABLE personal_foods (
				id TEXT PRIMARY KEY NOT NULL,
				name_en TEXT NOT NULL,
				name_nl TEXT NOT NULL,
				base_unit TEXT NOT NULL,
				nutrients_json TEXT NOT NULL,
				servings_json TEXT NOT NULL,
				provenance_json TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);
			PRAGMA user_version = 1;
		`);
		database.runSync(
			`INSERT INTO personal_foods
				(id, name_en, name_nl, base_unit, nutrients_json, servings_json, provenance_json, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			"58b7a219-67e5-42fc-9400-d740e8837df8",
			"Legacy oats",
			"Bestaande havermout",
			"g",
			JSON.stringify(nutrientStates()),
			"[]",
			JSON.stringify({
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			}),
			1,
			1,
		);

		const repository = createPersonalFoodRepository(database);

		expect(
			repository.find("58b7a219-67e5-42fc-9400-d740e8837df8"),
		).toMatchObject({
			name: { en: "Legacy oats", nl: "Bestaande havermout" },
			nutrients: nutrientStates(),
		});
	});
});

describe("forks of shipped foods", () => {
	function shippedApple() {
		const food = getShippedFood("shipped:apple-w-skin-av");
		if (!food) throw new Error("Expected the promoted apple in the library.");
		return food;
	}

	it("stores a fork under a new id that is not its shipped source", () => {
		const repository = createPersonalFoodRepository(new SQLiteTestDatabase());
		const source = shippedApple();

		const fork = repository.create(forkShippedFood(source));

		expect(fork.id).not.toBe(source.id);
		expect(fork.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		expect(repository.find(source.id)).toBeUndefined();
	});

	it("keeps the shipped source, NEVO provenance and edited state retrievable", () => {
		const database = new SQLiteTestDatabase();
		const source = shippedApple();
		const fork = createPersonalFoodRepository(database).create(
			forkShippedFood(source),
		);

		// A fresh repository over the same database — provenance is stored, not
		// held in memory.
		const reopened = createPersonalFoodRepository(database);
		const reloaded = reopened.find(fork.id);

		expect(reloaded?.provenance).toEqual({
			recordOrigin: "personal",
			nutritionSource: "nevo",
			locallyEdited: false,
			forkedFrom: source.id,
		});
		expect(reloaded && forkSource(reloaded)?.sourceName).toEqual(
			source.sourceName,
		);
	});

	it("lists forks most recently updated first and finds one by its source", () => {
		const repository = createPersonalFoodRepository(new SQLiteTestDatabase(), {
			now: stepwiseClock(),
		});
		const source = shippedApple();
		const own = repository.create(draft());
		const first = repository.create(forkShippedFood(source));
		const second = repository.create({
			...forkShippedFood(source),
			name: { en: "Market apple", nl: "Marktappel" },
		});

		expect(repository.forks().map((food) => food.id)).toEqual([
			second.id,
			first.id,
		]);
		expect(repository.findForkOf(source.id)?.id).toBe(second.id);
		expect(repository.forks().map((food) => food.id)).not.toContain(own.id);
		expect(repository.findForkOf("shipped:banana")).toBeUndefined();
	});

	it("records a corrected figure without touching the shipped food", () => {
		const repository = createPersonalFoodRepository(new SQLiteTestDatabase());
		const source = shippedApple();
		const base = forkShippedFood(source);

		const fork = repository.create({
			...base,
			nutrients: { ...base.nutrients, energy: { kind: "value", amount: 41 } },
			provenance: { ...base.provenance, locallyEdited: true },
		});

		expect(fork.nutrients.energy).toEqual({ kind: "value", amount: 41 });
		expect(fork.provenance.locallyEdited).toBe(true);
		expect(getShippedFood(source.id)?.nutrients.energy).toEqual(
			source.nutrients.energy,
		);
		expect(source.nutrients.energy).not.toEqual({ kind: "value", amount: 41 });
	});

	it("stops shadowing once the fork is deleted, leaving the source untouched", () => {
		const repository = createPersonalFoodRepository(new SQLiteTestDatabase());
		const source = shippedApple();
		const fork = repository.create(forkShippedFood(source));

		expect(repository.remove(fork.id)).toBe(true);
		expect(repository.forks()).toEqual([]);
		expect(repository.findForkOf(source.id)).toBeUndefined();
		expect(getShippedFood(source.id)?.name).toEqual(source.name);
	});
});
