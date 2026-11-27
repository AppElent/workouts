import { factsFrom } from "./session-workspace";

describe("factsFrom", () => {
	const personal = { _id: "mine", equipment: "dumbbell" } as const;

	it("reads a Personal Exercise measured in seconds as a hold with added load", () => {
		expect(
			factsFrom(
				{ ...personal, measure: "seconds" },
				undefined,
				undefined,
				"mine",
			),
		).toMatchObject({ timed: true, bodyweight: true });
		expect(factsFrom(personal, undefined, undefined, "mine")).toMatchObject({
			timed: false,
			bodyweight: false,
		});
	});

	it("knows a shipped hold before the catalog loads", () => {
		expect(
			factsFrom(undefined, undefined, undefined, "shipped:exercise:plank")
				.timed,
		).toBe(true);
	});
});
