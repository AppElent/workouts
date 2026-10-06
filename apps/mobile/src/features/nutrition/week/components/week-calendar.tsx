import { useState } from "react";
import { View } from "react-native";
import {
	type IsoDate,
	isoDateToLocalDate,
	toIsoDate,
} from "../../../../data/calendar-day";
import {
	weekDates,
	weekStartMonday,
} from "../../../../data/nutrition-weekly-review";
import { NutritionCalendar } from "../../../../ui/nutrition-calendar";
import { AppText } from "../../../../ui/text";
import { useLoggedDiaryDates } from "../../diary/use-logged-diary-dates";

/** The month calendar with the chosen week as one band; any day picks its week. */
export function WeekCalendar({
	weekStart,
	today,
	locale,
	hint,
	todayLabel,
	onSelect,
}: {
	weekStart: IsoDate;
	today: IsoDate;
	locale: "en" | "nl";
	hint: string;
	todayLabel: string;
	onSelect: (weekStart: IsoDate) => void;
}) {
	const [month, setMonth] = useState(`${weekStart.slice(0, 7)}-01`);
	const first = isoDateToLocalDate(month);
	const end = toIsoDate(
		new Date(first.getFullYear(), first.getMonth() + 1, 0, 12),
	);
	const logged = useLoggedDiaryDates(month, end);
	return (
		<View style={{ gap: 4 }}>
			<NutritionCalendar
				selectedDate={weekStart}
				today={today}
				locale={locale}
				markedDates={logged}
				highlightedDates={new Set(weekDates(weekStart))}
				labels={{ today: todayLabel }}
				onMonthChange={setMonth}
				onSelect={(date) => {
					const next = weekStartMonday(date > today ? today : date);
					onSelect(next);
				}}
			/>
			<AppText variant="caption" style={{ textAlign: "center" }}>
				{hint}
			</AppText>
		</View>
	);
}
