export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

/** One-off nutrition logging; Capture Drafts live in the Diary. */
import { useLocalSearchParams } from "expo-router";
import { diaryRouteParams } from "../../src/features/nutrition/diary-route-params";
import { OneOffLogScreen } from "../../src/features/nutrition/one-off/one-off-log-screen";

export default function NutritionOneOffRoute() {
	const params = useLocalSearchParams<{
		date?: string;
		meal?: string;
		draftId?: string;
	}>();
	const { date, meal } = diaryRouteParams(params);
	return (
		<OneOffLogScreen
			date={date}
			meal={meal}
			draftId={params.draftId || undefined}
		/>
	);
}
