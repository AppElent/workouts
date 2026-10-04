import { useConvexConnectionState } from "convex/react";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { todayIsoDate } from "../../../data/calendar-day";
import { MEAL_SLOTS, useNutritionDay } from "../../../data/nutrition-day";
import { useI18n } from "../../../i18n";
import { radius, spacing, useTokens } from "../../../theme";
import { DateStepper } from "../../../ui/date-stepper";
import { AppText } from "../../../ui/text";
export function DiaryEntryLabsScreen() {
	const { t, locale } = useI18n();
	const colors = useTokens();
	const [date, setDate] = useState(todayIsoDate());
	const state = useNutritionDay(date);
	const connected = useConvexConnectionState().isWebSocketConnected;
	return (
		<ScrollView
			contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
		>
			<Stack.Screen options={{ title: t.diaryEntry.labs }} />
			<AppText variant="title">{t.diaryEntry.labTitle}</AppText>
			<AppText>{t.diaryEntry.labIntro}</AppText>
			<DateStepper
				date={date}
				locale={locale}
				previousLabel={t.nutrition.day.previousDay}
				nextLabel={t.nutrition.day.nextDay}
				onChange={setDate}
			/>
			{state.status === "loading" ? (
				<AppText>
					{connected ? t.diaryEntry.loading : t.diaryEntry.uncachedDay}
				</AppText>
			) : (
				<>
					{MEAL_SLOTS.map((meal) => (
						<View key={meal}>
							<AppText variant="heading">{t.nutrition.meals[meal]}</AppText>
							{state.day.entries[meal].map((entry) => (
								<Pressable
									key={entry.id}
									accessibilityRole="button"
									accessibilityLabel={`${t.nutrition.entryEditor.title}: ${entry.name[locale]}`}
									style={{
										padding: spacing.md,
										marginTop: spacing.sm,
										backgroundColor: colors.surface,
										borderRadius: radius.lg,
									}}
									onPress={() =>
										router.push({
											pathname: "/labs-entry",
											params: { id: entry.id, meal, date },
										})
									}
								>
									<AppText>{entry.name[locale]}</AppText>
									<AppText variant="caption">{entry.serving[locale]}</AppText>
								</Pressable>
							))}
						</View>
					))}
					{MEAL_SLOTS.every((meal) => state.day.entries[meal].length === 0) && (
						<AppText>{t.diaryEntry.empty}</AppText>
					)}
				</>
			)}
		</ScrollView>
	);
}
