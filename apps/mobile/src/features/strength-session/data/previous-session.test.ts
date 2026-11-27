import type { Doc, Id } from "../../../convex/api";
import {
	pickPrevious,
	previousSetOf,
	previousSetsOf,
	totalsOf,
} from "./previous-session";

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
			() => false,
		);
		expect(totals.workingSets).toBe(3);
		expect(totals.reps).toBe(27);
		expect(totals.volume).toBe(80 * 8 + 80 * 9 + 60 * 10);
		expect(totals.top.bench).toEqual({ kg: 80, reps: 9 });
		expect(totals.byExercise.bench).toEqual({ sets: 2, volume: 80 * 17 });
		expect(totals.byExercise.row).toEqual({ sets: 1, volume: 600 });
		expect(totals.durationSeconds).toBe(3600);
	});

	it("keeps a hold's seconds out of reps and volume", () => {
		const totals = totalsOf(
			[
				{
					exerciseId: "hold",
					weight: 10,
					unit: "kg",
					reps: 45,
					setType: "working",
				},
			],
			null,
			(exerciseId) => exerciseId === "hold",
		);
		expect(totals).toMatchObject({ workingSets: 1, reps: 0, volume: 0 });
		expect(totals.byExercise.hold).toEqual({ sets: 1, volume: 0 });
	});
});

describe("previousSetOf", () => {
	const set = (
		setNumber: number,
		setType: "warmup" | "working",
		weight: number,
		exerciseId = "bench",
	) => ({
		exerciseId,
		setNumber,
		setType,
		weight,
		unit: "kg" as const,
		reps: 5,
		rpe: 8,
		loggedAt: 1000 + setNumber,
	});
	// Logged out of order, with another exercise in between.
	const last = [
		set(4, "working", 100),
		set(1, "warmup", 20),
		set(2, "warmup", 60),
		set(1, "working", 50, "squat"),
		set(3, "working", 90),
	];

	it("lists one exercise's sets in the order they were done", () => {
		expect(previousSetsOf(last, "bench").map((s) => s.weight)).toEqual([
			20, 60, 90, 100,
		]);
	});

	it("matches a working set by its place among working sets", () => {
		expect(previousSetOf(last, "bench", 1)).toEqual({
			kg: 90,
			reps: 5,
			rpe: 8,
			date: 1003,
		});
		expect(previousSetOf(last, "bench", 2)?.kg).toBe(100);
	});

	it("matches a warm-up among warm-ups only", () => {
		expect(previousSetOf(last, "bench", 1, true)?.kg).toBe(20);
		expect(previousSetOf(last, "bench", 2, true)?.kg).toBe(60);
	});

	it("uses the last one of its kind past the end", () => {
		expect(previousSetOf(last, "bench", 5)?.kg).toBe(100);
		expect(previousSetOf(last, "bench", 3, true)?.kg).toBe(60);
	});

	it("has nothing when that kind was not done last time", () => {
		expect(previousSetOf(last, "squat", 1, true)).toBeNull();
		expect(previousSetOf(last, "row", 1)).toBeNull();
	});
});
