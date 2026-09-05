/**
 * A row of mutually exclusive choices. The language switch is the first one; a
 * unit switch and a goal-direction switch are the obvious next.
 *
 * Plain `Pressable`s rather than a platform segmented control, for the same
 * reason `confirm-dialog.tsx` is a `Modal` rather than `Alert.alert`: this app
 * has one dark palette and a platform control cannot take it — including in the
 * case that matters most here, reading the language switch in the language you
 * are about to leave.
 *
 * Selection is announced, not only drawn. `accessibilityState.selected` is what
 * makes this a set of choices to a screen reader instead of N buttons with
 * different backgrounds, and it is why colour is never the only signal.
 */
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { AppText } from "./text";

export interface SegmentedOption<Value extends string> {
	value: Value;
	label: string;
	/** Spoken instead of the label, where the label alone is not a sentence. */
	accessibilityLabel?: string;
}

export function Segmented<Value extends string>({
	options,
	value,
	onChange,
}: {
	options: readonly SegmentedOption<Value>[];
	value: Value;
	onChange: (next: Value) => void;
}) {
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
							numberOfLines={1}
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
