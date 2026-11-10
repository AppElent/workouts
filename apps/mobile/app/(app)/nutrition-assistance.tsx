export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

import { MEAL_SLOTS, type MealSlot } from "@foundry/core";
import { useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/dates/calendar-day";
import { AssistanceScreen } from "../../src/features/nutrition/assistance/assistance-screen";

function asMealSlot(value: string | undefined): MealSlot {
	return MEAL_SLOTS.find((slot) => slot === value) ?? "breakfast";
}

/** Hulp bij invoeren: AI entry from text or a photo, reviewed before logging. */
export default function NutritionAssistanceRoute() {
	const { date, meal, text, draftId, from, resume } = useLocalSearchParams<{
		date?: string;
		meal?: string;
		text?: string;
		draftId?: string;
		from?: string;
		resume?: string;
	}>();
	return (
		<AssistanceScreen
			date={date ?? todayIsoDate()}
			meal={asMealSlot(meal)}
			text={text}
			draftId={draftId}
			fromFoodBrowser={from === "food"}
			resume={resume}
		/>
	);
}
