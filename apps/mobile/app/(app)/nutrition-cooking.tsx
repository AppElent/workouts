/** Home cooking hub: device-local recipes plus capture-later notes. */
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { todayIsoDate } from "../../src/data/calendar-day";
import { openNutritionCookingRepository } from "../../src/data/nutrition-cooking-repository";
import { MEAL_SLOTS, type MealSlot } from "../../src/data/nutrition-day";
import { mintNutritionUuid } from "../../src/data/nutrition-operation-service";
import { useI18n } from "../../src/i18n";
import { NutritionCookingScreen } from "../../src/screens/nutrition-cooking";
import { RouteError } from "../../src/ui/route-error";

export default function NutritionCookingRoute() {
	const { date, meal, mode, recipeId } = useLocalSearchParams<{
		date?: string;
		meal?: string;
		mode?: string;
		recipeId?: string;
	}>();
	const targetMeal: MealSlot = MEAL_SLOTS.includes(meal as MealSlot)
		? (meal as MealSlot)
		: "breakfast";
	const [repository] = useState(() =>
		openNutritionCookingRepository(mintNutritionUuid),
	);
	useEffect(() => () => repository.close(), [repository]);
	return (
		<NutritionCookingScreen
			date={date ?? todayIsoDate()}
			meal={targetMeal}
			repository={repository}
			initialMode={
				mode === "recipe-log" || mode === "draft-new" || mode === "oneoff-log"
					? mode
					: undefined
			}
			initialRecipeId={recipeId}
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
