/** Device-only Capture Drafts and direct One-off Entries. */
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { todayIsoDate } from "../../src/data/calendar-day";
import { useSuppliedCaptureDraftRepository } from "../../src/data/capture-draft-context";
import { openNutritionCookingRepository } from "../../src/data/nutrition-cooking-repository";
import { MEAL_SLOTS, type MealSlot } from "../../src/data/nutrition-day";
import { mintNutritionUuid } from "../../src/data/nutrition-operation-service";
import { useI18n } from "../../src/i18n";
import { NutritionCookingScreen } from "../../src/screens/nutrition-cooking";
import { RouteError } from "../../src/ui/route-error";

export default function NutritionCookingRoute() {
	const { date, meal, mode } = useLocalSearchParams<{
		date?: string;
		meal?: string;
		mode?: string;
	}>();
	const targetMeal: MealSlot = MEAL_SLOTS.includes(meal as MealSlot)
		? (meal as MealSlot)
		: "breakfast";
	const suppliedRepository = useSuppliedCaptureDraftRepository();
	const [repository] = useState(
		() =>
			suppliedRepository ?? openNutritionCookingRepository(mintNutritionUuid),
	);
	useEffect(() => {
		if (suppliedRepository) return;
		return () => repository.close();
	}, [repository, suppliedRepository]);
	return (
		<NutritionCookingScreen
			date={date ?? todayIsoDate()}
			meal={targetMeal}
			repository={repository}
			initialMode={
				mode === "draft-new" || mode === "oneoff-log" ? mode : undefined
			}
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
