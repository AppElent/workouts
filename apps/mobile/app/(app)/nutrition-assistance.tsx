export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

import { useLocalSearchParams } from "expo-router";
import { AssistanceScreen } from "../../src/features/nutrition/assistance/assistance-screen";
import { diaryRouteParams } from "../../src/features/nutrition/diary-route-params";

/** Hulp bij invoeren: AI entry from text or a photo, reviewed before logging. */
export default function NutritionAssistanceRoute() {
	const params = useLocalSearchParams<{
		date?: string;
		meal?: string;
		text?: string;
		draftId?: string;
		from?: string;
		resume?: string;
	}>();
	const { text, draftId, from, resume } = params;
	const { date, meal } = diaryRouteParams(params);
	return (
		<AssistanceScreen
			date={date}
			meal={meal}
			text={text}
			draftId={draftId}
			fromFoodBrowser={from === "food"}
			resume={resume}
		/>
	);
}
