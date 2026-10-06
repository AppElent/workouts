import { useConvexConnectionState } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import {
	isoDateToLocalDate,
	todayIsoDate,
	toIsoDate,
} from "../../src/data/calendar-day";
import { MEAL_SLOTS, useNutritionDay } from "../../src/data/nutrition-day";
import { DiaryEntryEditorScreen } from "../../src/features/nutrition/diary-entry/diary-entry-editor-screen";
import { useI18n } from "../../src/i18n";
import { RouteError } from "../../src/ui/route-error";
import { AppText } from "../../src/ui/text";
export default function NutritionEntryRoute() {
	const params = useLocalSearchParams<{
		id?: string;
		meal?: string;
		date?: string;
	}>();
	const { t } = useI18n();
	const connected = useConvexConnectionState().isWebSocketConnected;
	const date =
		typeof params.date === "string" &&
		/^\d{4}-\d{2}-\d{2}$/.test(params.date) &&
		toIsoDate(isoDateToLocalDate(params.date)) === params.date
			? params.date
			: todayIsoDate();
	const meal = MEAL_SLOTS.find((slot) => slot === params.meal) ?? "breakfast";
	const state = useNutritionDay(date);
	const current =
		state.status === "ready"
			? state.day.entries[meal].find((entry) => entry.id === params.id)
			: undefined;
	const retained = useRef(current);
	if (!retained.current && current) retained.current = current;
	// Keep the editor mounted during its optimistic meal/date move.
	const entry = retained.current;
	if (!entry)
		return (
			<AppText>
				{state.status === "loading"
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
