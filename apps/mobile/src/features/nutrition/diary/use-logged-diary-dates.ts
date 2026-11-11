import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";

export function useLoggedDiaryDates(startDate: string, endDate: string) {
	const remote = useQuery(api.nutritionDiary.loggedDates, {
		startDate,
		endDate,
	});
	return new Set(Array.isArray(remote) ? remote : []);
}
