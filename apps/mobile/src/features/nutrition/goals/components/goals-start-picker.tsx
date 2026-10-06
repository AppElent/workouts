import { GOAL_PRESET_KEYS, type GoalPresetKey } from "@workouts/core/nutrition";
import { SymbolView } from "expo-symbols";
import { Pressable, View } from "react-native";
import { useI18n } from "../../../../i18n";
import { radius, spacing, useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";

/** With no goals yet, a starting point is the first step; "Set it yourself" is the other. */
export function GoalsStartPicker({
	onPreset,
	onCustom,
}: {
	onPreset: (key: GoalPresetKey) => void;
	onCustom: () => void;
}) {
	const { t } = useI18n();
	const copy = t.nutrition.goalEditor;
	const colors = useTokens();
	const card = {
		minHeight: 64,
		paddingHorizontal: spacing.md,
		paddingVertical: 12,
		borderRadius: radius.contentCard,
		borderCurve: "continuous" as const,
		flexDirection: "row" as const,
		alignItems: "center" as const,
		gap: 14,
	};
	return (
		<View style={{ gap: spacing.sm }}>
			<View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
				<AppText variant="title" accessibilityRole="header">
					{copy.chooseStart}
				</AppText>
				<AppText variant="footnote">{copy.chooseStartBody}</AppText>
			</View>
			{GOAL_PRESET_KEYS.map((key) => (
				<Pressable
					key={key}
					accessibilityRole="button"
					accessibilityLabel={`${copy.presets[key].name}, ${copy.presetSummary[key]}`}
					onPress={() => onPreset(key)}
					style={({ pressed }) => [
						card,
						{ backgroundColor: pressed ? colors.surface2 : colors.surface },
					]}
				>
					<View
						style={{
							width: 44,
							height: 44,
							borderRadius: radius.lg,
							backgroundColor: colors.surface2,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<SymbolView
							name={{ ios: "target", android: "adjust", web: "adjust" }}
							size={20}
							tintColor={colors.text}
						/>
					</View>
					<View style={{ flex: 1 }}>
						<AppText variant="secondary" style={{ color: colors.text }}>
							{copy.presets[key].name}
						</AppText>
						<AppText variant="footnote">{copy.presetSummary[key]}</AppText>
					</View>
				</Pressable>
			))}
			<Pressable
				accessibilityRole="button"
				onPress={onCustom}
				style={({ pressed }) => [
					card,
					{
						minHeight: 52,
						backgroundColor: pressed ? colors.surface2 : colors.surface,
					},
				]}
			>
				<SymbolView
					name={{ ios: "pencil", android: "edit", web: "edit" }}
					size={16}
					tintColor={colors.accent}
				/>
				<AppText
					variant="secondary"
					style={{ color: colors.accent, fontWeight: "700" }}
				>
					{copy.setYourself}
				</AppText>
			</Pressable>
			<AppText variant="footnote" style={{ paddingHorizontal: spacing.xs }}>
				{copy.chooseStartFooter}
			</AppText>
		</View>
	);
}
