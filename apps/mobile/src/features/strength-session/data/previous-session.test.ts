import type { Doc, Id } from "../../../convex/api";
import { pickPrevious, totalsOf } from "./previous-session";

const id = (value: string) => value as Id<"workoutSessions">;
const routine = (value: string) => value as Id<"routines">;

function session(
	value: Omit<Partial<Doc<"workoutSessions">>, "_id"> & { _id: string },
): Doc<"workoutSessions"> {
	return {
		_creationTime: 0,
		userId: "u",
		date: 0,
		startTime: 0,
		status: "completed",
		...value,
		_id: id(value._id),
	} as Doc<"workoutSessions">;
}

describe("pickPrevious", () => {
	const recent = [
		session({ _id: "now", status: "active", routineId: routine("push") }),
		session({ _id: "other", routineId: routine("pull") }),
		session({
			_id: "cancelled",
			status: "cancelled",
			routineId: routine("push"),
		}),
		session({ _id: "push-1", routineId: routine("push") }),
		session({ _id: "named", name: "Leg day" }),
	];

	it("takes the latest finished session of the same routine", () => {
		expect(
			pickPrevious({ _id: id("now"), routineId: routine("push") }, recent)?._id,
		).toBe("push-1");
	});

	it("falls back to the same name without a routine", () => {
		expect(pickPrevious({ _id: id("x"), name: "Leg day" }, recent)?._id).toBe(
			"named",
		);
	});

	it("finds nothing for a free session", () => {
		expect(pickPrevious({ _id: id("x") }, recent)).toBeUndefined();
	});
});

describe("totalsOf", () => {
	it("counts working sets only and keeps the heaviest set per exercise", () => {
		const totals = totalsOf(
			[
				{
					exerciseId: "bench",
					weight: 40,
					unit: "kg",
					reps: 10,
					setType: "warmup",
				},
				{
					exerciseId: "bench",
					weight: 80,
					unit: "kg",
					reps: 8,
					setType: "working",
				},
				{
					exerciseId: "bench",
					weight: 80,
					unit: "kg",
					reps: 9,
					setType: "working",
				},
				{
					exerciseId: "row",
					weight: 60,
					unit: "kg",
					reps: 10,
					setType: "working",
				},
			],
			3600,
		);
		expect(totals.workingSets).toBe(3);
		expect(totals.reps).toBe(27);
		expect(totals.volume).toBe(80 * 8 + 80 * 9 + 60 * 10);
		expect(totals.top.bench).toEqual({ kg: 80, reps: 9 });
		expect(totals.durationSeconds).toBe(3600);
	});
});
