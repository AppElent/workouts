import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
	formatLongDate,
	type IsoDate,
	isoDateToLocalDate,
	todayIsoDate,
	toIsoDate,
} from "../data/calendar-day";
import { colors, radius, spacing } from "../theme";
import { AppText } from "./text";

export type NutritionCalendarLabels = {
	previousMonth: string;
	nextMonth: string;
	today: string;
	selected: string;
};

const DEFAULT_LABELS: NutritionCalendarLabels = {
	previousMonth: "Previous month",
	nextMonth: "Next month",
	today: "Today",
	selected: "Selected",
};

const DUTCH_LABELS: NutritionCalendarLabels = {
	previousMonth: "Vorige maand",
	nextMonth: "Volgende maand",
	today: "Vandaag",
	selected: "Geselecteerd",
};

const FALLBACK_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthAnchor(date: IsoDate): Date {
	const selected = isoDateToLocalDate(date);
	return new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
}

function monthDays(year: number, month: number): number {
	return new Date(year, month + 1, 0, 12).getDate();
}

function mondayOffset(year: number, month: number): number {
	return (new Date(year, month, 1, 12).getDay() + 6) % 7;
}

function dateForDay(year: number, month: number, day: number): IsoDate {
	return toIsoDate(new Date(year, month, day, 12));
}

function monthTitle(date: Date, locale: string): string {
	try {
		return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
	} catch {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
	}
}

function weekdays(locale: string): string[] {
	try {
		const monday = new Date(2024, 0, 1, 12);
		return Array.from({ length: 7 }, (_, index) => {
			const date = new Date(monday);
			date.setDate(monday.getDate() + index);
			return date.toLocaleDateString(locale, { weekday: "short" });
		});
	} catch {
		return FALLBACK_WEEKDAYS;
	}
}

export function NutritionCalendar({
	selectedDate,
	onSelect,
	locale = "en",
	today = todayIsoDate(),
	labels,
}: {
	selectedDate: IsoDate;
	onSelect: (date: IsoDate) => void;
	locale?: string;
	today?: IsoDate;
	labels?: Partial<NutritionCalendarLabels>;
}) {
	const copy = {
		...(locale === "nl" ? DUTCH_LABELS : DEFAULT_LABELS),
		...labels,
	};
	const [visibleMonth, setVisibleMonth] = useState(() =>
		monthAnchor(selectedDate),
	);
	useEffect(() => {
		setVisibleMonth(monthAnchor(selectedDate));
	}, [selectedDate]);

	const year = visibleMonth.getFullYear();
	const month = visibleMonth.getMonth();
	const days = useMemo(
		() =>
			Array.from({ length: monthDays(year, month) }, (_, index) => index + 1),
		[month, year],
	);
	const cells: { day: number | null; key: string }[] = [
		...Array.from({ length: mondayOffset(year, month) }, (_, index) => ({
			day: null,
			key: `empty-${year}-${month}-${index}`,
		})),
		...days.map((day) => ({ day, key: dateForDay(year, month, day) })),
	];
	while (cells.length % 7 !== 0) {
		cells.push({ day: null, key: `empty-${year}-${month}-${cells.length}` });
	}

	const moveMonth = (delta: number) => {
		setVisibleMonth(new Date(year, month + delta, 1, 12));
	};

	return (
		<View accessibilityRole="summary" style={styles.root}>
			<View style={styles.header}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={copy.previousMonth}
					onPress={() => moveMonth(-1)}
					style={styles.navButton}
				>
					<AppText variant="heading" style={styles.navGlyph}>
						‹
					</AppText>
				</Pressable>
				<AppText
					variant="heading"
					accessibilityRole="header"
					style={styles.title}
				>
					{monthTitle(visibleMonth, locale)}
				</AppText>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={copy.nextMonth}
					onPress={() => moveMonth(1)}
					style={styles.navButton}
				>
					<AppText variant="heading" style={styles.navGlyph}>
						›
					</AppText>
				</Pressable>
			</View>
			<View style={styles.weekdays}>
				{weekdays(locale).map((weekday) => (
					<AppText key={weekday} variant="caption" style={styles.weekday}>
						{weekday}
					</AppText>
				))}
			</View>
			<View style={styles.grid}>
				{cells.map((cell) => {
					if (cell.day === null) {
						return <View key={cell.key} style={styles.cell} />;
					}
					const date = cell.key;
					const isSelected = date === selectedDate;
					const isToday = date === today;
					return (
						<Pressable
							key={date}
							accessibilityRole="button"
							accessibilityLabel={`${formatLongDate(date, locale)}, ${date}${isSelected ? `, ${copy.selected}` : ""}`}
							accessibilityState={{ selected: isSelected }}
							onPress={() => onSelect(date)}
							style={({ pressed }) => [
								styles.cell,
								isSelected && styles.selected,
								isToday && !isSelected && styles.today,
								pressed && styles.pressed,
							]}
						>
							<AppText style={isSelected ? styles.selectedText : undefined}>
								{cell.day}
							</AppText>
						</Pressable>
					);
				})}
			</View>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={copy.today}
				onPress={() => onSelect(today)}
				style={styles.todayButton}
			>
				<AppText style={styles.todayText}>{copy.today}</AppText>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { gap: spacing.sm },
	header: { flexDirection: "row", alignItems: "center" },
	title: { flex: 1, textAlign: "center", textTransform: "capitalize" },
	navButton: {
		minWidth: 44,
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.pill,
	},
	navGlyph: { color: colors.accent, fontSize: 28 },
	weekdays: { flexDirection: "row" },
	weekday: { flex: 1, textAlign: "center", fontWeight: "700" },
	grid: { flexDirection: "row", flexWrap: "wrap" },
	cell: {
		width: "14.2857%",
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.pill,
	},
	selected: { backgroundColor: colors.accent },
	selectedText: { color: colors.onAccent, fontWeight: "800" },
	today: { borderColor: colors.accent, borderWidth: 1 },
	pressed: { backgroundColor: colors.surface2 },
	todayButton: { alignSelf: "center", padding: spacing.sm, minHeight: 44 },
	todayText: { color: colors.accent, fontWeight: "800" },
});
