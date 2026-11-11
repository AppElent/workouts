export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

/**
 * Route for finding and logging food into one meal on one day.
 *
 * A sibling of `(coach)`, not a screen inside it, so it is *pushed over* the
 * tab bar the way `exercises.tsx` and `session.tsx` are. That placement gives
 * what a conditional render inside the tab could not: the iOS edge-swipe back
 * gesture, an Android hardware back that closes the browser instead of leaving
 * the app, and a real navigation stack the diary sits underneath.
 */
import { router, useLocalSearchParams } from "expo-router";
import { diaryRouteParams } from "../../src/features/nutrition/diary-route-params";
import { LogFoodScreen } from "../../src/features/nutrition/log-food/log-food-screen";

export default function NutritionFoodRoute() {
	const params = useLocalSearchParams<{
		meal?: string;
		date?: string;
		draftId?: string;
		query?: string;
		create?: string;
		comboId?: string;
		replacePartId?: string;
	}>();
	const { draftId, query, create, comboId, replacePartId } = params;
	const { date, meal } = diaryRouteParams(params);

	return (
		<LogFoodScreen
			meal={meal}
			date={date}
			draftId={draftId || undefined}
			initialQuery={query || undefined}
			target={
				comboId
					? { comboId, replacePartId: replacePartId || undefined }
					: undefined
			}
			initialCreateKind={
				create === "personal" || create === "recipe" ? create : undefined
			}
			onClose={() => router.back()}
		/>
	);
}
