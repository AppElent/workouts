import type { IsoDate, Locale } from "@foundry/core";

export interface WeekDatePickerProps {
	weekStart: IsoDate;
	today: IsoDate;
	locale: Locale;
	label: string;
	hint: string;
	todayLabel: string;
	onSelect: (weekStart: IsoDate) => void;
}
