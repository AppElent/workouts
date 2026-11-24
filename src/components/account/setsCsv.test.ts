import { expect, it } from "vitest";
import { setsToCsv } from "./setsCsv";

const session = { _id: "s1", name: "Core day", date: 0 };
const set = (patch: Record<string, unknown>) => ({
	sessionId: "s1",
	setNumber: 1,
	setType: "working",
	weight: 0,
	unit: "kg",
	reps: 8,
	loggedAt: 0,
	...patch,
});

it("labels a hold's count as seconds and leaves reps empty", () => {
	const names = new Map([
		["shipped:exercise:plank", "Plank"],
		["squat", "Squat"],
	]);
	const csv = setsToCsv(
		{
			workoutSessions: [session],
			sets: [
				set({ exerciseId: "squat", reps: 5, loggedAt: 1 }),
				set({ exerciseId: "shipped:exercise:plank", reps: 45, loggedAt: 2 }),
			],
		},
		names,
	);
	const [header, squat, plank] = csv.split("\n").map((l) => l.split(","));
	expect(header?.slice(-3)).toEqual(["reps", "seconds", "rpe"]);
	expect(squat?.slice(-3)).toEqual(["5", "", ""]);
	expect(plank?.slice(-3)).toEqual(["", "45", ""]);
});
