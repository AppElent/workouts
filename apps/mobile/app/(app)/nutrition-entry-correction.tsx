export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

import { NUTRIENT_KEYS } from "@foundry/core";
import { useLocalSearchParams } from "expo-router";
import { DiaryEntryCorrectionScreen } from "../../src/features/nutrition/diary-entry/diary-entry-correction-screen";
import { useRetainedDiaryEntry } from "../../src/features/nutrition/diary-entry/use-retained-diary-entry";
import { diaryRouteParams } from "../../src/features/nutrition/diary-route-params";
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
	const { date, meal } = diaryRouteParams(params);
	const { entry, loading } = useRetainedDiaryEntry(date, meal, params.id);
	const nutrient = NUTRIENT_KEYS.find((key) => key === params.nutrient);
	if (!entry || !nutrient)
		return (
			<AppText>
				{loading && nutrient ? t.diaryEntry.loading : t.diaryEntry.missingEntry}
			</AppText>
		);
	return (
		<DiaryEntryCorrectionScreen
			key={entry.id}
			entry={entry}
			nutrient={nutrient}
		/>
	);
}
