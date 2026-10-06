import type { IsoDate } from "../../../../data/calendar-day";

export interface WeekDatePickerProps {
	weekStart: IsoDate;
	today: IsoDate;
	locale: "en" | "nl";
	label: string;
	hint: string;
	todayLabel: string;
	onSelect: (weekStart: IsoDate) => void;
}
