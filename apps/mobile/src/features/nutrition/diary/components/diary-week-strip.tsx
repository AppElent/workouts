import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import {
	formatLongDate,
	isoDateToLocalDate,
	shiftIsoDate,
	toIsoDate,
} from "../../../../data/calendar-day";
import { useNutritionDrafts } from "../../../../data/nutrition-drafts";
import { useI18n } from "../../../../i18n";
import { radius, useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";
import { useLoggedDiaryDates } from "../use-logged-diary-dates";

export function DiaryWeekStrip({
	date,
	onChange,
	loggedDates: knownDates,
}: {
	date: string;
	onChange: (date: string) => void;
	loggedDates?: ReadonlySet<string>;
}) {
	const { locale } = useI18n();
	const colors = useTokens();
	const drafts = useNutritionDrafts();
	const scroll = useRef<ScrollView>(null);
	const [width, setWidth] = useState(0);
	const d = isoDateToLocalDate(date);
	d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
	const monday = toIsoDate(d);
	const fetchedDates = useLoggedDiaryDates(
		shiftIsoDate(monday, -7),
		shiftIsoDate(monday, 13),
	);
	const loggedDates = new Set([...fetchedDates, ...(knownDates ?? [])]);
	useEffect(() => {
		if (width && monday)
			scroll.current?.scrollTo({ x: width, animated: false });
	}, [width, monday]);
	return (
		<View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
			<ScrollView
				ref={scroll}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				onMomentumScrollEnd={(e) => {
					if (!width) return;
					const page = Math.round(e.nativeEvent.contentOffset.x / width);
					if (page !== 1) onChange(shiftIsoDate(date, (page - 1) * 7));
				}}
			>
				{[-1, 0, 1].map((week) => (
					<View
						key={week}
						style={{ width, flexDirection: "row", paddingVertical: 8 }}
					>
						{Array.from({ length: 7 }, (_, i) => {
							const day = shiftIsoDate(monday, week * 7 + i);
							const selected = day === date;
							const noteCount = drafts.listForDate(day).length;
							const noteLabel =
								locale === "nl"
									? `${noteCount} ${noteCount === 1 ? "onverwerkte notitie" : "onverwerkte notities"}`
									: `${noteCount} unresolved ${noteCount === 1 ? "note" : "notes"}`;
							const local = isoDateToLocalDate(day);
							return (
								<Pressable
									key={day}
									accessibilityRole="button"
									accessibilityLabel={`${formatLongDate(day, locale)}${noteCount ? `, ${noteLabel}` : ""}`}
									accessibilityState={{ selected }}
									onPress={() => onChange(day)}
									style={{
										flex: 1,
										minHeight: 56,
										marginHorizontal: 3,
										alignItems: "center",
										justifyContent: "center",
										borderRadius: radius.lg,
										backgroundColor: selected ? colors.accentFill : undefined,
										gap: 2,
									}}
								>
									<AppText
										variant="caption"
										style={{
											color: selected ? colors.onAccent : colors.textMuted,
											textTransform: "uppercase",
										}}
									>
										{local
											.toLocaleDateString(locale, { weekday: "short" })
											.slice(0, 2)}
									</AppText>
									<AppText
										variant="row"
										style={{ color: selected ? colors.onAccent : colors.text }}
									>
										{local.getDate()}
									</AppText>
									<View
										style={{
											height: 12,
											flexDirection: "row",
											alignItems: "center",
											justifyContent: "center",
											gap: 4,
										}}
									>
										{loggedDates.has(day) ? (
											<View
												style={{
													width: 4,
													height: 4,
													borderRadius: 2,
													backgroundColor: selected
														? colors.onAccent
														: colors.accent,
												}}
											/>
										) : null}
										{noteCount ? (
											<SymbolView
												name="note.text"
												size={11}
												tintColor={selected ? colors.onAccent : colors.accent}
											/>
										) : null}
									</View>
								</Pressable>
							);
						})}
					</View>
				))}
			</ScrollView>
		</View>
	);
}
