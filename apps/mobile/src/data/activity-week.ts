import type { ActivitySummary } from "@workouts/core";
import {
	isoDateToLocalDayRangeMs,
	shiftIsoDate,
	todayIsoDate,
} from "./calendar-day";
import { weekStartMonday } from "./nutrition-weekly-review";

export function activityWeek(date = todayIsoDate()) {
	const start = weekStartMonday(date);
	return {
		start,
		from: isoDateToLocalDayRangeMs(start).from,
		to: isoDateToLocalDayRangeMs(shiftIsoDate(start, 7)).from,
	};
}

export function activityTotals(items: readonly ActivitySummary[]) {
	return items.reduce(
		(totals, item) => ({
			count: totals.count + 1,
			durationSeconds: totals.durationSeconds + item.durationSeconds,
			distanceMeters: totals.distanceMeters + (item.distanceMeters ?? 0),
		}),
		{ count: 0, durationSeconds: 0, distanceMeters: 0 },
	);
}

export function activityWeeks(
	items: readonly ActivitySummary[],
	current: string,
) {
	return Array.from({ length: 12 }, (_, index) => {
		const week = activityWeek(shiftIsoDate(current, (index - 11) * 7));
		return {
			...week,
			...activityTotals(
				items.filter(
					(item) => item.occurredAt >= week.from && item.occurredAt < week.to,
				),
			),
		};
	});
}
