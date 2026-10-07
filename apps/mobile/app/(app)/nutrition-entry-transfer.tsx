import { router, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import { todayIsoDate } from "../../src/data/calendar-day";
import {
	type DiaryEntryWithMeal,
	MEAL_SLOTS,
	useNutritionDay,
} from "../../src/data/nutrition-day";
import { isRealIsoDate } from "../../src/data/nutrition-weekly-review";
import { DiaryEntryTransferScreen } from "../../src/features/nutrition/diary-entry/diary-entry-transfer-screen";
import { useI18n } from "../../src/i18n";
import { AppText } from "../../src/ui/text";

export { ErrorBoundary } from "./nutrition-entry";
export default function NutritionEntryTransferRoute() {
	const params = useLocalSearchParams<{
		date?: string;
		entryIds?: string;
		mode?: string;
	}>();
	const { t } = useI18n();
	const date =
		params.date && isRealIsoDate(params.date) ? params.date : todayIsoDate();
	const state = useNutritionDay(date);
	const retained = useRef<DiaryEntryWithMeal[] | null>(null);
	if (!retained.current && state.status === "ready") {
		const ids = new Set(params.entryIds?.split(","));
		retained.current = MEAL_SLOTS.flatMap((meal) =>
			state.day.entries[meal].map((e) => ({ ...e, meal })),
		).filter((e) => ids.has(e.id));
	}
	if (!retained.current?.length)
		return (
			<AppText>
				{state.status === "loading"
					? t.diaryEntry.loading
					: t.diaryEntry.missingEntry}
			</AppText>
		);
	return (
		<DiaryEntryTransferScreen
			entries={retained.current}
			date={date}
			mode={params.mode === "move" ? "move" : "copy"}
			onClose={() => router.back()}
		/>
	);
}
