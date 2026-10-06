import { useConvexConnectionState, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/api";
import { type IsoDate, todayIsoDate } from "../../../data/calendar-day";
import {
	useNutritionOperations,
	useNutritionOperationVersion,
} from "../../../data/nutrition-operation-service";
import {
	isRealIsoDate,
	type WeeklyReviewDay,
	weekStartMonday,
} from "../../../data/nutrition-weekly-review";
import { useStalledOffline } from "../../../data/stalled-offline";

/** The chosen week's server review plus whether device changes are still queued. */
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
	const operations = useNutritionOperations();
	useNutritionOperationVersion();
	const subject = operations.getSubject();
	const pending = subject
		? operations
				.getOperations(subject)
				.some((operation) => operation.status !== "acknowledged")
		: false;
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
		pending,
		stalledOffline,
		retry: () => {
			setRetrying(true);
			setTimeout(() => setRetrying(false), 0);
		},
	};
}
