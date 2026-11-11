export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

import { router, useLocalSearchParams } from "expo-router";
import { useOnline } from "../../src/convex/online";
import { DiaryEntryEditorScreen } from "../../src/features/nutrition/diary-entry/diary-entry-editor-screen";
import { useRetainedDiaryEntry } from "../../src/features/nutrition/diary-entry/use-retained-diary-entry";
import { diaryRouteParams } from "../../src/features/nutrition/diary-route-params";
import { useI18n } from "../../src/i18n";
import { AppText } from "../../src/ui/text";

export default function NutritionEntryRoute() {
	const params = useLocalSearchParams<{
		id?: string;
		meal?: string;
		date?: string;
	}>();
	const { t } = useI18n();
	const connected = useOnline();
	const { date, meal } = diaryRouteParams(params);
	const { entry, loading } = useRetainedDiaryEntry(date, meal, params.id);
	if (!entry)
		return (
			<AppText>
				{loading
					? connected
						? t.diaryEntry.loading
						: t.diaryEntry.uncachedDay
					: t.diaryEntry.missingEntry}
			</AppText>
		);
	return (
		<DiaryEntryEditorScreen
			key={entry.id}
			entry={entry}
			date={date}
			meal={meal}
			onClose={() =>
				router.canGoBack() ? router.back() : router.replace("/nutrition")
			}
		/>
	);
}
