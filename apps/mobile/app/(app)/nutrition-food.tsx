/**
 * Route for finding and logging food into one meal on one day.
 *
 * A sibling of `(coach)`, not a screen inside it, so it is *pushed over* the
 * tab bar the way `exercises.tsx` and `session.tsx` are. That placement is what
 * buys the three things spec #68 asks for and a conditional render inside the
 * tab could never give: the iOS edge-swipe back gesture, an Android hardware
 * back that closes the browser instead of leaving the app, and a real
 * navigation stack the diary sits underneath rather than being replaced by.
 *
 * The meal and the date arrive as params rather than props because a pushed
 * route has no parent to hand it either. `meal` is validated here rather than
 * trusted: a deep link is user input, and the four slots are a closed set.
 */
import { router, useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/data/calendar-day";
import { MEAL_SLOTS, type MealSlot } from "../../src/data/nutrition-day";
import { useI18n } from "../../src/i18n";
import { NutritionFoodBrowser } from "../../src/screens/nutrition-food-browser";
import { RouteError } from "../../src/ui/route-error";

function asMealSlot(value: string | undefined): MealSlot {
	return MEAL_SLOTS.find((slot) => slot === value) ?? "breakfast";
}

export default function NutritionFoodRoute() {
	const { meal, date } = useLocalSearchParams<{
		meal?: string;
		date?: string;
	}>();
	return (
		<NutritionFoodBrowser
			meal={asMealSlot(meal)}
			date={date ?? todayIsoDate()}
			onClose={() => router.back()}
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
