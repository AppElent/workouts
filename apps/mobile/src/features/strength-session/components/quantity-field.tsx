import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useI18n } from "../../../i18n";
import { radius, spacing, type, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";
export function QuantityField({
	label,
	value,
	unit,
	integer = false,
	step,
	max,
	disabled,
	onChange,
}: {
	label: string;
	value: string;
	unit?: string;
	integer?: boolean;
	step: number;
	max: number;
	disabled: boolean;
	onChange: (value: string) => void;
}) {
	const colors = useTokens();
	const {
		t: { strength: copy },
	} = useI18n();
	function adjust(direction: number) {
		const parsed = Number(value.replace(",", "."));
		onChange(
			String(
				Math.round(
					Math.max(
						0,
						Math.min(
							max,
							(Number.isFinite(parsed) ? parsed : 0) + direction * step,
						),
					) * 1e6,
				) / 1e6,
			),
		);
	}
	return (
		<View style={[styles.container, { backgroundColor: colors.surface }]}>
			<AppText variant="label">
				{label}
				{unit ? ` · ${unit}` : ""}
			</AppText>
			<View style={styles.row}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`${copy.decrease} ${label}`}
					disabled={disabled}
					onPress={() => adjust(-1)}
					style={styles.button}
				>
					<AppText variant="title">−</AppText>
				</Pressable>
				<TextInput
					accessibilityLabel={label}
					value={value}
					onChangeText={onChange}
					editable={!disabled}
					keyboardType={integer ? "number-pad" : "decimal-pad"}
					selectTextOnFocus
					style={[styles.input, { color: colors.text }]}
				/>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`${copy.increase} ${label}`}
					disabled={disabled}
					onPress={() => adjust(1)}
					style={styles.button}
				>
					<AppText variant="title">+</AppText>
				</Pressable>
			</View>
		</View>
	);
}
const styles = StyleSheet.create({
	container: {
		flex: 1,
		minWidth: 150,
		borderRadius: radius.contentCard,
		padding: spacing.sm,
	},
	row: { flexDirection: "row", alignItems: "center" },
	button: {
		minWidth: 44,
		minHeight: 48,
		alignItems: "center",
		justifyContent: "center",
	},
	input: {
		flex: 1,
		minWidth: 30,
		minHeight: 48,
		padding: 0,
		textAlign: "center",
		...type.display,
		fontVariant: ["tabular-nums"],
	},
});
