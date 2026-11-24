import { daysAgo, recentExerciseIds } from "./session-quick-start";

describe("recentExerciseIds", () => {
	it("takes finished sessions first, newest first, then records", () => {
		expect(
			recentExerciseIds(
				[
					{ status: "active", exercises: [{ exerciseId: "now" }] },
					{
						status: "completed",
						exercises: [{ exerciseId: "bench" }, { exerciseId: "row" }],
					},
					{ status: "completed", exercises: [{ exerciseId: "bench" }] },
					{ status: "completed" },
				],
				[
					{ exerciseId: "squat", date: 1 },
					{ exerciseId: "row", date: 3 },
					{ exerciseId: "curl", date: 2 },
				],
			),
		).toEqual(["bench", "row", "curl", "squat"]);
	});
});

describe("recentExerciseIds frequency", () => {
	it("puts the most-done exercise first", () => {
		expect(
			recentExerciseIds(
				[
					{ status: "completed", exercises: [{ exerciseId: "row" }] },
					{ status: "completed", exercises: [{ exerciseId: "squat" }] },
					{ status: "completed", exercises: [{ exerciseId: "squat" }] },
				],
				[],
			),
		).toEqual(["squat", "row"]);
	});
});

describe("daysAgo", () => {
	it("counts calendar days, not 24-hour spans", () => {
		const now = new Date(2026, 10, 23, 9, 0).getTime();
		expect(daysAgo(new Date(2026, 10, 23, 7, 0).getTime(), now)).toBe(0);
		expect(daysAgo(new Date(2026, 10, 22, 23, 0).getTime(), now)).toBe(1);
		expect(daysAgo(new Date(2026, 10, 21, 10, 0).getTime(), now)).toBe(2);
	});
});
