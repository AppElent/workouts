import { recentExerciseIds } from "./session-quick-start";

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
