import { useState } from "react";
import { isoDateToLocalDate, toIsoDate } from "../../../../data/calendar-day";
import { NutritionCalendar } from "../../../../ui/nutrition-calendar";
import { useLoggedDiaryDates } from "../use-logged-diary-dates";
export function DiaryCalendar({
	date,
	onSelect,
	locale,
}: {
	date: string;
	onSelect: (date: string) => void;
	locale: "en" | "nl";
}) {
	const [month, setMonth] = useState(`${date.slice(0, 7)}-01`);
	const d = isoDateToLocalDate(month);
	const end = toIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
	const logged = useLoggedDiaryDates(month, end);
	return (
		<NutritionCalendar
			selectedDate={date}
			onSelect={onSelect}
			locale={locale}
			markedDates={logged}
			onMonthChange={setMonth}
		/>
	);
}
