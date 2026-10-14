import { useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/data/calendar-day";
import { MEAL_SLOTS, type MealSlot } from "../../src/data/nutrition-day";
import { AssistanceScreen } from "../../src/features/nutrition/assistance/assistance-screen";
import { useI18n } from "../../src/i18n";
import { RouteError } from "../../src/ui/route-error";

function asMealSlot(value: string | undefined): MealSlot {
	return MEAL_SLOTS.find((slot) => slot === value) ?? "breakfast";
}

/** Hulp bij invoeren: AI entry from text or a photo, reviewed before logging. */
export default function NutritionAssistanceRoute() {
	const { date, meal, text, draftId, from } = useLocalSearchParams<{
		date?: string;
		meal?: string;
		text?: string;
		draftId?: string;
		from?: string;
	}>();
	return (
		<AssistanceScreen
			date={date ?? todayIsoDate()}
			meal={asMealSlot(meal)}
			text={text}
			draftId={draftId}
			fromFoodBrowser={from === "food"}
		/>
	);
}

export function ErrorBoundary({
	error,
	retry,
}: {
	error: Error;
	retry: () => Promise<void>;
}) {
	const { t } = useI18n();
	return (
		<RouteError
			title={t.nutrition.error.title}
			body={t.nutrition.error.body}
			retryLabel={t.common.retry}
			onRetry={() => {
				retry();
			}}
			error={error}
		/>
	);
}
