import { useState } from "react";
import {
	formatShortDate,
	shiftIsoDate,
	todayIsoDate,
} from "../../../data/calendar-day";
import { MEAL_SLOTS, type MealSlot } from "../../../data/nutrition-day";
import { useI18n } from "../../../i18n";
import { DatePickerSheet } from "../../../ui/date-picker-sheet";
import { GlassSurface } from "../../../ui/glass-surface";
import { SelectionMenu } from "../../../ui/selection-menu";

/** Meal ⌄ and date ⌄ in an amount editor's toolbar: where the amount goes. */
export function AmountDestination({
	meal,
	date,
	disabled,
	onMealChange,
	onDateChange,
}: {
	meal: MealSlot;
	date: string;
	disabled: boolean;
	onMealChange: (meal: MealSlot) => void;
	onDateChange: (date: string) => void;
}) {
	const { t, locale } = useI18n();
	const copy = t.diaryEntry;
	const [today] = useState(() => todayIsoDate());
	const [dateOpen, setDateOpen] = useState(false);
	const day = (offset: number, label: string) => ({
		id: shiftIsoDate(today, offset),
		label,
		selected: date === shiftIsoDate(today, offset),
	});
	return (
		<>
			<GlassSurface capsule>
				<SelectionMenu
					label={t.nutrition.meals[meal]}
					accessibilityLabel={t.nutrition.entryEditor.meal}
					disabled={disabled}
					groups={[
						{
							options: MEAL_SLOTS.map((slot) => ({
								id: slot,
								label: t.nutrition.meals[slot],
								selected: meal === slot,
							})),
						},
					]}
					onSelect={(id) => {
						const slot = MEAL_SLOTS.find((item) => item === id);
						if (slot) onMealChange(slot);
					}}
				/>
			</GlassSurface>
			<GlassSurface capsule>
				<SelectionMenu
					label={date === today ? copy.today : formatShortDate(date, locale)}
					accessibilityLabel={t.nutrition.entryEditor.date}
					disabled={disabled}
					groups={[
						{
							options: [
								day(-1, copy.yesterday),
								day(0, copy.today),
								day(1, copy.tomorrow),
								{ id: "other", label: copy.otherDate },
							],
						},
					]}
					onSelect={(id) =>
						id === "other" ? setDateOpen(true) : onDateChange(id)
					}
				/>
			</GlassSurface>
			<DatePickerSheet
				visible={dateOpen}
				date={date}
				today={today}
				locale={locale}
				title={t.nutrition.entryEditor.date}
				todayLabel={copy.today}
				doneLabel={copy.done}
				closeLabel={copy.cancel}
				onSelect={onDateChange}
				onClose={() => setDateOpen(false)}
			/>
		</>
	);
}
