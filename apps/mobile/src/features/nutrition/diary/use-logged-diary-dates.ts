import { useQuery } from "convex/react";
import { api } from "../../../convex/api";
import { isoDayOffset, shiftIsoDate } from "../../../data/calendar-day";
import {
	useNutritionOperations,
	useNutritionOperationVersion,
} from "../../../data/nutrition-operation-service";
export function useLoggedDiaryDates(startDate: string, endDate: string) {
	const remote = useQuery(api.nutritionDiary.loggedDates, {
		startDate,
		endDate,
	});
	const operations = useNutritionOperations();
	useNutritionOperationVersion();
	const subject = operations.getSubject();
	const dates = new Set(Array.isArray(remote) ? remote : []);
	if (subject)
		for (let i = 0; i <= isoDayOffset(startDate, endDate); i++) {
			const date = shiftIsoDate(startDate, i);
			const local = operations.getProjectedDay(subject, date);
			if (local?.entries.length) dates.add(date);
			else if (local?.complete) dates.delete(date);
		}
	return dates;
}
