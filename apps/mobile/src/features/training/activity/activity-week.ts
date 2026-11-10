import {
	type ActivitySummary,
	enduranceTotals,
	shiftIsoDate,
	weekStartMonday,
} from "@foundry/core";
import {
	isoDateToLocalDayRangeMs,
	todayIsoDate,
} from "../../../dates/calendar-day";

export function activityWeek(date = todayIsoDate()) {
	const start = weekStartMonday(date);
	return {
		start,
		from: isoDateToLocalDayRangeMs(start).from,
		to: isoDateToLocalDayRangeMs(shiftIsoDate(start, 7)).from,
	};
}

export function activityWeeks(
	items: readonly ActivitySummary[],
	current: string,
) {
	return Array.from({ length: 12 }, (_, index) => {
		const week = activityWeek(shiftIsoDate(current, (index - 11) * 7));
		return {
			...week,
			...enduranceTotals(
				items.filter(
					(item) => item.occurredAt >= week.from && item.occurredAt < week.to,
				),
			),
		};
	});
}
