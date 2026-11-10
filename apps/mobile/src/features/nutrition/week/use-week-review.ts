import type { IsoDate } from "@foundry/core";
import { useConvexConnectionState } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { useStalledOffline } from "../../../convex/stalled-offline";
import {
	isRealIsoDate,
	type WeeklyReviewDay,
	weekStartMonday,
} from "../../../data/nutrition-weekly-review";
import { todayIsoDate } from "../../../dates/calendar-day";

/** The chosen week's acknowledged account data. */
export function useWeekReview(startDate: string | undefined) {
	const [today] = useState(() => todayIsoDate());
	const current = weekStartMonday(today);
	const requested =
		startDate && isRealIsoDate(startDate)
			? weekStartMonday(startDate)
			: current;
	const [week, setWeek] = useState<IsoDate>(
		[requested, current].sort()[0] ?? current,
	);
	const result = useQuery(api.nutritionReview.week, {
		startDate: week,
		today,
	});
	const { isWebSocketConnected } = useConvexConnectionState();
	const stalledOffline = useStalledOffline(
		result === undefined,
		isWebSocketConnected,
	);
	const days: readonly WeeklyReviewDay[] | undefined = result?.days;
	return {
		today,
		week,
		setWeek: (next: IsoDate) => setWeek(next > current ? current : next),
		days,
		stalledOffline,
	};
}
