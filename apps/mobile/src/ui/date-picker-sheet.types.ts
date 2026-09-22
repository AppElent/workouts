/**
 * Picking a calendar date, presented over whatever asked for it.
 *
 * iOS gets the system's own `DatePicker` — the graphical month grid people
 * already know from Calendar and Reminders — rather than a calendar this app
 * drew itself. Android keeps the app's calendar until its Material dialog has
 * been exercised on a device.
 *
 * "Today" belongs here rather than in a navigation bar: as a toolbar action it
 * is disabled exactly when you are already on today, which is most of the time,
 * so it reads as a control that does nothing.
 */
export interface DatePickerSheetProps {
	visible: boolean;
	/** The selected date, `YYYY-MM-DD`. */
	date: string;
	/** What "today" means for this session, fixed at mount by the caller. */
	today: string;
	locale: string;
	title: string;
	todayLabel: string;
	doneLabel: string;
	closeLabel: string;
	onSelect: (date: string) => void;
	onClose: () => void;
}
