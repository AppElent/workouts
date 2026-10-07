import { roundForDisplay } from "@workouts/core/nutrition";
import { formatLongDate, formatShortDate } from "../../data/calendar-day";
import {
	type DiaryEntry,
	MEAL_SLOTS,
	type MealSlot,
	useNutritionDay,
} from "../../data/nutrition-day";
import { useI18n } from "../../i18n";
import type { NutritionDestinationMenuProps } from "./components/nutrition-destination-menu-props";
import { logFoodCopy } from "./log-food/log-food-copy";

function energyLabel(entries: readonly DiaryEntry[]): string | undefined {
	if (!entries.length) return undefined;
	const total = entries.reduce((sum, entry) => {
		const energy = entry.nutrients.energy;
		return energy.kind === "value" ? sum + energy.amount : sum;
	}, 0);
	return `${roundForDisplay("energy", total)} kcal`;
}

/**
 * Where a log goes, as the title menu Log food and the one-off form share:
 * each meal with what is already in it that day, and "Other day…".
 */
export function useMealDestinationMenu({
	date,
	meal,
	today,
	onSelectMeal,
	onOtherDay,
}: {
	date: string;
	meal: MealSlot;
	today: string;
	onSelectMeal: (slot: MealSlot) => void;
	onOtherDay: () => void;
}) {
	const { t, locale } = useI18n();
	const copy = logFoodCopy(locale);
	const day = useNutritionDay(date);
	const entriesFor = (slot: MealSlot) =>
		day.status === "ready" ? day.day.entries[slot] : [];
	const mealName = t.nutrition.meals[meal];
	const menu: NutritionDestinationMenuProps = {
		label: copy.destinationLabel(mealName, formatLongDate(date, locale)),
		mealName,
		dayLabel:
			date === today
				? `${copy.today} · ${formatShortDate(date, locale)}`
				: formatShortDate(date, locale),
		sectionTitle: copy.logInto,
		closeLabel: copy.closeMenu,
		otherDayLabel: copy.otherDay,
		options: MEAL_SLOTS.map((slot) => {
			const entries = entriesFor(slot);
			return {
				slot,
				selected: slot === meal,
				label: t.nutrition.meals[slot],
				detail: entries.length
					? copy.mealTally(entries.length, energyLabel(entries))
					: copy.mealNothing,
			};
		}),
		onSelectMeal,
		onOtherDay,
	};
	return { menu, entriesFor, energyLabel };
}
