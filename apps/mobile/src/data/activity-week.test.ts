import type { ActivitySummary } from "@workouts/core";
import { activityTotals, activityWeek, activityWeeks } from "./activity-week";

it("uses Monday to Monday local calendar boundaries", () => {
	const week = activityWeek("2026-09-27");
	expect(week.start).toBe("2026-09-21");
	expect(new Date(week.from)).toEqual(new Date(2026, 8, 21));
	expect(new Date(week.to)).toEqual(new Date(2026, 8, 28));
});

it("sums more than the old eight-row recent limit and assigns midnight to one week", () => {
	const week = activityWeek("2026-09-21");
	const rows: ActivitySummary[] = Array.from({ length: 14 }, (_, i) => ({
		id: String(i),
		sport: "running",
		occurredAt: week.from + i,
		durationSeconds: 1800,
		distanceMeters: 5000,
	}));
	expect(activityTotals(rows)).toEqual({
		count: 14,
		durationSeconds: 25200,
		distanceMeters: 70000,
	});
	const weeks = activityWeeks(
		[...rows, { ...rows[0], id: "prior", occurredAt: week.from - 1 }],
		week.start,
	);
	expect(weeks).toHaveLength(12);
	expect(weeks[11].count).toBe(14);
	expect(weeks[10].count).toBe(1);
	expect(weeks[0].count).toBe(0);
});
