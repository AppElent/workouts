import {
	latestBodyweightKg,
	levelKey,
	levelOf,
	startLoadKg,
	strengthLevels,
} from "./strength-levels";

describe("strength levels", () => {
	it("maps shipped ids and retained copies to a lift", () => {
		expect(levelKey("shipped:exercise:barbell-bench-press")).toBe(
			"barbell-bench-press",
		);
		expect(levelKey("abc123", "shipped:exercise:barbell-row")).toBe(
			"barbell-row",
		);
		expect(levelKey("abc123")).toBeNull();
	});

	it("gives kilograms for the bodyweight and nothing for unknown lifts", () => {
		const levels = strengthLevels("barbell-bench-press", 80);
		expect(levels?.map((level) => level.fromKg)).toEqual([40, 80, 120, 152]);
		expect(levels?.at(-1)?.toKg).toBeNull();
		expect(strengthLevels("barbell-bench-press", null)?.[1]?.fromKg).toBeNull();
		expect(strengthLevels("cable-fly", 80)).toBeNull();
		expect(strengthLevels(null, 80)).toBeNull();
	});

	it("places a 1RM and says how far the next level is", () => {
		const levels = strengthLevels("barbell-bench-press", 80) ?? [];
		expect(levelOf(levels, 103, 80)).toEqual({ index: 1, toNextKg: 17 });
		expect(levelOf(levels, 20, 80).index).toBe(0);
		expect(levelOf(levels, 160, 80)).toEqual({ index: 3, toNextKg: null });
	});

	it("starts at 75% of the level's middle", () => {
		const levels = strengthLevels("barbell-bench-press", 80) ?? [];
		expect(startLoadKg(levels[1] as never, 80)).toBeCloseTo(75);
	});

	it("reads the newest logged weight in kg", () => {
		expect(
			latestBodyweightKg([
				{ unit: "kg" },
				{ weight: 176, unit: "lbs" },
				{ weight: 70, unit: "kg" },
			]),
		).toBeCloseTo(79.83, 1);
		expect(latestBodyweightKg([])).toBeNull();
	});
});
