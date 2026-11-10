import type { Locale } from "@foundry/core";
import type { IsoDate } from "../../../../dates/calendar-day";

export interface WeekDatePickerProps {
	weekStart: IsoDate;
	today: IsoDate;
	locale: Locale;
	label: string;
	hint: string;
	todayLabel: string;
	onSelect: (weekStart: IsoDate) => void;
}
