import { dailyBest, exerciseInsight } from "./exercise-insight";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 10, 18, 12).getTime();

const set = (
	id: string,
	sessionId: string,
	daysAgo: number,
	setNumber: number,
	weight: number,
	reps: number,
	setType = "working",
) => ({
	_id: id,
	sessionId,
	sessionDate: NOW - daysAgo * DAY,
	setNumber,
	weight,
	unit: "kg" as const,
	reps,
	setType,
});

describe("dailyBest", () => {
	it("keeps the highest record per day", () => {
		const points = dailyBest([
			{ value: 95, unit: "kg", date: NOW - 2 * DAY },
			{ value: 98, unit: "kg", date: NOW - 2 * DAY + 1000 },
			{ value: 100, unit: "kg", date: NOW },
		]);
		expect(points.map((point) => point.kg)).toEqual([98, 100]);
	});
});

describe("exerciseInsight", () => {
	const history = [
		set("a", "s1", 40, 1, 40, 10, "warmup"),
		set("b", "s1", 40, 2, 75, 8),
		set("c", "s2", 7, 1, 85, 5),
		set("d", "s3", 0, 2, 80, 8),
		set("e", "s3", 0, 1, 80, 8),
	];
	const records = [
		{ value: 95, unit: "kg" as const, date: NOW - 40 * DAY },
		{ value: 101, unit: "kg" as const, date: NOW },
	];

	it("finds the best set, recent volume and sessions", () => {
		const insight = exerciseInsight(history, records, NOW);
		expect(insight.best).toEqual({ kg: 85, reps: 5, date: NOW - 7 * DAY });
		expect(insight.volume).toBe(85 * 5 + 80 * 8 * 2);
		expect(insight.volumeChange).toBe(
			Math.round(((85 * 5 + 1280 - 600) / 600) * 100),
		);
		expect(insight.sessionCount).toBe(3);
		expect(insight.trend).toEqual({ kg: 6, weeks: 6 });
	});

	it("groups sets per session, newest first, with records marked", () => {
		const { sessions } = exerciseInsight(history, records, NOW);
		expect(sessions.map((session) => session.sessionId)).toEqual([
			"s3",
			"s2",
			"s1",
		]);
		expect(sessions[0]?.rows.map((row) => row.id)).toEqual(["e", "d"]);
		expect(sessions[0]?.rows[0]?.record).toBe(true);
		expect(sessions[2]?.rows[0]?.estimate).toBeNull();
	});

	it("adds no volume for a hold", () => {
		expect(exerciseInsight(history, [], NOW, true).volume).toBe(0);
		expect(exerciseInsight(history, [], NOW).trend).toBeNull();
	});

	it("ends the trend at the headline 1RM, so the delta matches it (APP-624)", () => {
		// A manual 99 entered 19 days ago; today's estimate is higher (101.8).
		const manual = { value: 99, unit: "kg" as const, date: NOW - 19 * DAY };
		const stored = [
			{ value: 92.5, unit: "kg" as const, date: NOW - 60 * DAY },
			{ value: 95, unit: "kg" as const, date: NOW - 40 * DAY },
			manual,
			{ value: 101.8, unit: "kg" as const, date: NOW },
		];
		const insight = exerciseInsight(history, stored, NOW, false, manual);
		expect(insight.points.map((point) => point.kg)).toEqual([92.5, 95, 99]);
		expect(insight.points.at(-1)?.kg).toBe(99);
		// From the first point in the 12-week window to the headline.
		expect(insight.trend?.kg).toBe(6.5);
	});

	it("follows an estimated headline to today", () => {
		const current = { value: 101, unit: "kg" as const, date: NOW };
		const insight = exerciseInsight(history, records, NOW, false, current);
		expect(insight.points.map((point) => point.kg)).toEqual([95, 101]);
	});
});

describe("exerciseInsight set notes", () => {
	it("carries each set's trimmed note, empty without one", () => {
		const { sessions } = exerciseInsight(
			[
				{ ...set("a", "s1", 0, 1, 80, 8), notes: "  narrow grip " },
				set("b", "s1", 0, 2, 80, 8),
			],
			[],
			NOW,
		);
		expect(sessions[0]?.rows.map((row) => row.notes)).toEqual([
			"narrow grip",
			"",
		]);
	});
});
