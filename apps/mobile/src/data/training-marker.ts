/**
 * Which days of a range have a completed Activity session — the only v1
 * connection between Activity and Nutrition (ticket #78). The wire contract
 * (`convex/nutritionActivityMarker.ts`) is one bare boolean per day, so there
 * is no duration, intensity, calories, or training load for this hook to
 * carry even if it wanted to; it cannot feed Nutrition's goal or total
 * calculations by accident because it never touches them.
 *
 * The marker is decorative, so it uses `useQuery_experimental` rather than
 * the throwing `useQuery` the rest of the day screen uses: a slow, failed, or
 * offline lookup must make the markers quietly absent, never block or error
 * the food diary around it.
 */
import { useQuery_experimental as useQuery } from "convex/react";
import { api } from "../convex/api";
import {
	type IsoDate,
	isoDateToLocalDayRangeMs,
	isoDayOffset,
	shiftIsoDate,
} from "./calendar-day";

const NONE: ReadonlySet<IsoDate> = new Set();

export function useTrainedDates(
	startDate: IsoDate,
	endDate: IsoDate,
): ReadonlySet<IsoDate> {
	const dates = Array.from(
		{ length: isoDayOffset(startDate, endDate) + 1 },
		(_, i) => shiftIsoDate(startDate, i),
	);
	const result = useQuery({
		query: api.nutritionActivityMarker.completedActivityDays,
		args: { days: dates.map((date) => isoDateToLocalDayRangeMs(date)) },
	});
	if (result.status !== "success" || !Array.isArray(result.data)) return NONE;
	return new Set(dates.filter((_, i) => result.data[i]));
}
