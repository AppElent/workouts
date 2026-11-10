export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

import { isRealIsoDate, MEAL_SLOTS, NUTRIENT_KEYS } from "@foundry/core";
import { useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import { useNutritionDay } from "../../src/data/nutrition-day";
import { todayIsoDate } from "../../src/dates/calendar-day";
import { DiaryEntryCorrectionScreen } from "../../src/features/nutrition/diary-entry/diary-entry-correction-screen";
import { useI18n } from "../../src/i18n";
import { AppText } from "../../src/ui/text";

export default function DiaryEntryCorrectionRoute() {
	const params = useLocalSearchParams<{
		id?: string;
		date?: string;
		meal?: string;
		nutrient?: string;
	}>();
	const { t } = useI18n();
	const date =
		params.date && isRealIsoDate(params.date) ? params.date : todayIsoDate();
	const meal = MEAL_SLOTS.find((m) => m === params.meal) ?? "breakfast";
	const state = useNutritionDay(date);
	const current =
		state.status === "ready"
			? state.day.entries[meal].find((e) => e.id === params.id)
			: undefined;
	const retained = useRef(current);
	if (!retained.current && current) retained.current = current;
	if (!retained.current)
		return (
			<AppText>
				{state.status === "loading"
					? t.diaryEntry.loading
					: t.diaryEntry.missingEntry}
			</AppText>
		);
	return (
		<DiaryEntryCorrectionScreen
			key={retained.current.id}
			entry={retained.current}
			nutrient={NUTRIENT_KEYS.find((n) => n === params.nutrient) ?? "fibre"}
		/>
	);
}
