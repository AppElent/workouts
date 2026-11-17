import { formatSetFull, formatSetShort, LOADED_FORMAT } from "./session-format";

const HOLD = { bodyweight: true, timed: true };
const BODYWEIGHT = { bodyweight: true, timed: false };

describe("set formats", () => {
	it("reads a hold in seconds", () => {
		expect(formatSetShort({ kg: 0, unit: "kg", reps: 45 }, HOLD, "en")).toBe(
			"45 s",
		);
		expect(formatSetShort({ kg: 10, unit: "kg", reps: 45 }, HOLD, "en")).toBe(
			"+10 × 45 s",
		);
		expect(formatSetFull({ kg: 0, unit: "kg", reps: 60 }, HOLD, "nl")).toBe(
			"60 s",
		);
	});
	it("keeps reps for other exercises", () => {
		expect(
			formatSetShort({ kg: 0, unit: "kg", reps: 12 }, BODYWEIGHT, "en"),
		).toBe("+0 × 12");
		expect(
			formatSetFull({ kg: 95, unit: "kg", reps: 5 }, LOADED_FORMAT, "en"),
		).toBe("95 kg × 5");
	});
});
