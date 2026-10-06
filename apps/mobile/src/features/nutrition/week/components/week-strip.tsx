import { Pressable, View } from "react-native";
import { type IsoDate, shiftIsoDate } from "../../../../data/calendar-day";
import { weekDates } from "../../../../data/nutrition-weekly-review";
import { fmt, useI18n } from "../../../../i18n";
import { radius, spacing, useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";
import { useLoggedDiaryDates } from "../../diary/use-logged-diary-dates";
import { isoWeekNumber } from "../week-summary";

/** Recent weeks as chips, ending at the current week; dots mark logged days. */
export function WeekStrip({
	weeks,
	selected,
	onSelect,
	trailing,
}: {
	weeks: readonly IsoDate[];
	selected: IsoDate;
	onSelect: (weekStart: IsoDate) => void;
	trailing?: React.ReactNode;
}) {
	const { t } = useI18n();
	const copy = t.nutrition.week;
	const colors = useTokens();
	const logged = useLoggedDiaryDates(
		weeks[0],
		shiftIsoDate(weeks[weeks.length - 1], 6),
	);
	return (
		<View style={{ flexDirection: "row", gap: 6 }}>
			{weeks.map((week) => {
				const active = week === selected;
				const days = weekDates(week);
				const loggedCount = days.filter((day) => logged.has(day)).length;
				const number = isoWeekNumber(week);
				return (
					<Pressable
						key={week}
						accessibilityRole="button"
						accessibilityLabel={fmt(copy.weekLabel, {
							number,
							logged: loggedCount,
						})}
						accessibilityState={{ selected: active }}
						onPress={() => onSelect(week)}
						style={({ pressed }) => ({
							flex: 1,
							minHeight: 58,
							paddingVertical: 6,
							borderRadius: radius.lg,
							alignItems: "center",
							justifyContent: "center",
							gap: 1,
							backgroundColor: active
								? colors.accentFill
								: pressed
									? colors.surface2
									: "transparent",
						})}
					>
						<AppText
							variant="caption"
							style={{
								fontWeight: "700",
								color: active ? colors.onAccent : colors.textMuted,
							}}
						>
							{copy.weekShort}
						</AppText>
						<AppText
							variant="heading"
							style={{ color: active ? colors.onAccent : colors.text }}
						>
							{number}
						</AppText>
						<View style={{ flexDirection: "row", gap: 2 }}>
							{days.map((day) => (
								<View
									key={day}
									style={{
										width: 4,
										height: 4,
										borderRadius: 2,
										backgroundColor: logged.has(day)
											? active
												? colors.onAccent
												: colors.accent
											: active
												? `${colors.onAccent}40`
												: colors.surface2,
									}}
								/>
							))}
						</View>
					</Pressable>
				);
			})}
			{trailing ? (
				<View
					style={{
						flex: 1,
						minHeight: 58,
						borderRadius: radius.lg,
						backgroundColor: colors.surface,
						alignItems: "center",
						justifyContent: "center",
						marginLeft: spacing.xs,
					}}
				>
					{trailing}
				</View>
			) : null}
		</View>
	);
}
