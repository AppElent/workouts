/**
 * Whether a completed Activity session falls on this Nutrition day — the
 * only v1 connection between Activity and Nutrition (ticket #78). The wire
 * contract (`convex/nutritionActivityMarker.ts`) is a bare boolean, so there
 * is no duration, intensity, calories, or training load for this hook to
 * carry even if it wanted to; it cannot feed Nutrition's goal or total
 * calculations by accident because it never touches them.
 *
 * The marker is decorative, so it uses `useQuery_experimental` rather than
 * the throwing `useQuery` the rest of the day screen uses: a slow, failed, or
 * offline lookup must make the marker quietly absent, never block or error
 * the food diary around it.
 */
import { useQuery_experimental as useQuery } from "convex/react";
import { api } from "../convex/api";
import { type IsoDate, isoDateToLocalDayRangeMs } from "./calendar-day";

export type TrainingMarkerState = "hidden" | "visible";

export function useTrainingMarker(date: IsoDate): TrainingMarkerState {
	const { from, to } = isoDateToLocalDayRangeMs(date);
	const result = useQuery({
		query: api.nutritionActivityMarker.hasCompletedActivity,
		args: { from, to },
	});
	return result.status === "success" && result.data ? "visible" : "hidden";
}
