import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { radius, spacing, type Tokens, useThemedStyles } from "../theme";
import { GhostButton } from "./button";
import type { DatePickerSheetProps } from "./date-picker-sheet.types";
import { NutritionCalendar } from "./nutrition-calendar";
import { AppText } from "./text";

/**
 * Android and web keep the app's own calendar, in the same sheet.
 *
 * `@expo/ui` does ship a Material `DatePickerDialog`, and this should become
 * that — but it has not been exercised on a device here, and the calendar below
 * is already carrying the diary. Swapping it is a change to make with an
 * emulator open, not blind.
 */
export function DatePickerSheet({
	visible,
	date,
	today,
	locale,
	title,
	todayLabel,
	doneLabel,
	closeLabel,
	onSelect,
	onClose,
}: DatePickerSheetProps) {
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const reduceMotion = useReduceMotion();
	return (
		<Modal
			visible={visible}
			transparent
			presentationStyle="overFullScreen"
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={onClose}
		>
			<Pressable
				style={styles.backdrop}
				accessibilityRole="button"
				accessibilityLabel={closeLabel}
				onPress={onClose}
			>
				<Pressable
					style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
					onPress={() => {}}
					accessibilityViewIsModal
				>
					<View style={styles.grabber} />
					<View style={styles.header}>
						<AppText variant="heading" style={styles.flex}>
							{title}
						</AppText>
						<GhostButton
							label={todayLabel}
							onPress={() => onSelect(today)}
							disabled={date === today}
						/>
						<GhostButton label={doneLabel} onPress={onClose} />
					</View>
					<NutritionCalendar
						selectedDate={date}
						onSelect={onSelect}
						locale={locale}
						today={today}
						labels={
							locale === "nl"
								? {
										previousMonth: "Vorige maand",
										nextMonth: "Volgende maand",
										today: todayLabel,
										selected: "Geselecteerd",
									}
								: undefined
						}
					/>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		flex: { flex: 1 },
		backdrop: {
			flex: 1,
			justifyContent: "flex-end",
			backgroundColor: colors.scrim,
		},
		sheet: {
			gap: spacing.sm,
			borderTopLeftRadius: radius.sheet,
			borderTopRightRadius: radius.sheet,
			backgroundColor: colors.surface,
			paddingHorizontal: spacing.md,
			paddingTop: spacing.sm,
		},
		grabber: {
			alignSelf: "center",
			width: 36,
			height: 4,
			borderRadius: radius.pill,
			backgroundColor: colors.borderStrong,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			minHeight: 44,
		},
	});
