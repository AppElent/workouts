import { useConvexConnectionState } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { type IsoDate, todayIsoDate } from "../../../data/calendar-day";

import {
	isRealIsoDate,
	type WeeklyReviewDay,
	weekStartMonday,
} from "../../../data/nutrition-weekly-review";
import { useStalledOffline } from "../../../data/stalled-offline";

/** The chosen week's acknowledged account data. */
export function useWeekReview(startDate: string | undefined) {
	const [today] = useState(() => todayIsoDate());
	const current = weekStartMonday(today);
	const requested =
		startDate && isRealIsoDate(startDate)
			? weekStartMonday(startDate)
			: current;
	const [week, setWeek] = useState<IsoDate>(
		requested > current ? current : requested,
	);
	const [retrying, setRetrying] = useState(false);
	const result = useQuery(
		api.nutritionReview.week,
		retrying ? "skip" : { startDate: week, today },
	);
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
		retry: () => {
			setRetrying(true);
			setTimeout(() => setRetrying(false), 0);
		},
	};
}
