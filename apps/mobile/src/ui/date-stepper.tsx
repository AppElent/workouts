/**
 * Previous/next arrows around a formatted date. The Nutrition day view uses it
 * to move through the diary; the entry editor uses the same control to move a
 * single entry to another calendar date, so the stepping behaviour and its
 * accessible labels stay in one place instead of drifting apart.
 */
import { Pressable, StyleSheet, View } from "react-native";
import { formatLongDate, shiftIsoDate } from "../data/calendar-day";
import { colors, radius, spacing } from "../theme";
import { AppText } from "./text";

export function DateStepper({
	date,
	locale,
	previousLabel,
	nextLabel,
	onChange,
	onChooseDate,
	chooseDateLabel,
	displayLabel,
	secondaryLabel,
}: {
	date: string;
	locale: string;
	previousLabel: string;
	nextLabel: string;
	onChange: (next: string) => void;
	onChooseDate?: () => void;
	chooseDateLabel?: string;
	displayLabel?: string;
	secondaryLabel?: string;
}) {
	return (
		<View style={styles.stepper}>
			<StepperButton
				label={previousLabel}
				glyph="‹"
				onPress={() => onChange(shiftIsoDate(date, -1))}
			/>
			{onChooseDate ? (
				<Pressable
					style={{ flex: 1, minHeight: 44, justifyContent: "center" }}
					accessibilityRole="button"
					accessibilityLabel={chooseDateLabel ?? formatLongDate(date, locale)}
					accessibilityValue={{ text: formatLongDate(date, locale) }}
					onPress={onChooseDate}
				>
					<AppText style={[styles.stepperDate, { flex: 0 }]}>
						{displayLabel ?? formatLongDate(date, locale)}
					</AppText>
					{secondaryLabel ? (
						<AppText variant="caption" style={{ textAlign: "center" }}>
							{secondaryLabel}
						</AppText>
					) : null}
				</Pressable>
			) : (
				<AppText style={styles.stepperDate}>
					{formatLongDate(date, locale)}
				</AppText>
			)}
			<StepperButton
				label={nextLabel}
				glyph="›"
				onPress={() => onChange(shiftIsoDate(date, 1))}
			/>
		</View>
	);
}

function StepperButton({
	label,
	glyph,
	onPress,
}: {
	label: string;
	glyph: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			style={({ pressed }) => [
				styles.iconButton,
				pressed ? { backgroundColor: colors.surface2 } : null,
			]}
		>
			<AppText variant="heading" style={{ color: colors.accent }}>
				{glyph}
			</AppText>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	stepperDate: { flex: 1, textAlign: "center", fontWeight: "700" },
	iconButton: {
		// 44pt minimum touch target, per the platform's own guidance — as a
		// minimum rather than a fixed size, so the glyph still fits when the
		// person has turned text size up.
		minWidth: 44,
		minHeight: 44,
		padding: 4,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.pill,
	},
});
