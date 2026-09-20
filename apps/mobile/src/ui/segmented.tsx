/**
 * A row of mutually exclusive choices — the React Native drawing, for Android
 * and tests. iOS gets the system segmented control in `segmented.ios.tsx`.
 *
 * Selection is announced, not only drawn. `accessibilityState.selected` is what
 * makes this a set of choices to a screen reader instead of N buttons with
 * different backgrounds, and it is why colour is never the only signal.
 */
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import type { SegmentedOption, SegmentedProps } from "./segmented.types";
import { AppText } from "./text";

export type { SegmentedOption, SegmentedProps };

export function Segmented<Value extends string>({
	options,
	value,
	onChange,
}: SegmentedProps<Value>) {
	return (
		<View style={styles.row}>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<Pressable
						key={option.value}
						accessibilityRole="button"
						accessibilityState={{ selected }}
						accessibilityLabel={option.accessibilityLabel ?? option.label}
						onPress={() => onChange(option.value)}
						style={({ pressed }) => [
							styles.option,
							{
								backgroundColor: selected ? colors.accent : colors.surface,
								borderColor: selected ? colors.accent : colors.border,
							},
							pressed && !selected
								? { backgroundColor: colors.surface2 }
								: null,
						]}
					>
						<AppText
							// Two lines, not one. Four options across a phone is tight
							// already, and at large text sizes a single line turns
							// "Breakfast" into "Break…" — a choice the user cannot read
							// is not a choice.
							numberOfLines={2}
							style={{
								fontWeight: "700",
								color: selected ? colors.onAccent : colors.text,
							}}
						>
							{option.label}
						</AppText>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", gap: spacing.sm },
	option: {
		flex: 1,
		// 44pt: the platform minimum hit target, which a language switch has no
		// excuse to fall under.
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.sm,
		borderWidth: 1,
		borderRadius: radius.lg,
	},
});
