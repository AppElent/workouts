import { useState } from "react";
import { isoDateToLocalDate, toIsoDate } from "../../../../dates/calendar-day";
import { MonthCalendar } from "../../../../ui/month-calendar";
import { useLoggedDiaryDates } from "../use-logged-diary-dates";
export function DiaryCalendar({
	date,
	onSelect,
}: {
	date: string;
	onSelect: (date: string) => void;
}) {
	const [month, setMonth] = useState(`${date.slice(0, 7)}-01`);
	const d = isoDateToLocalDate(month);
	const end = toIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
	const logged = useLoggedDiaryDates(month, end);
	return (
		<MonthCalendar
			selectedDate={date}
			onSelect={onSelect}
			markedDates={logged}
			onMonthChange={setMonth}
		/>
	);
}
