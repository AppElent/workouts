import { SymbolView } from "expo-symbols";
import { Keyboard, Pressable, View } from "react-native";
import { radius, spacing, useTokens } from "../../../../theme";
import { GlassSurface } from "../../../../ui/glass-surface";
import { AppText } from "../../../../ui/text";
import { NutritionKeyboardOverlay } from "../../components/nutrition-keyboard-overlay";

/** ‹ › walk the fields in display order without closing the keyboard. */
export function GoalsKeyboardBar({
	label,
	previousLabel,
	nextLabel,
	doneLabel,
	onPrevious,
	onNext,
}: {
	/** The focused field, e.g. "Saturated fat · maximum"; null hides the bar. */
	label: string | null;
	previousLabel: string;
	nextLabel: string;
	doneLabel: string;
	onPrevious?: () => void;
	onNext?: () => void;
}) {
	const colors = useTokens();
	const step = (
		accessibilityLabel: string,
		glyph: "chevron.left" | "chevron.right",
		onPress?: () => void,
	) => (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityState={{ disabled: !onPress }}
			disabled={!onPress}
			onPress={onPress}
			style={{
				minWidth: 44,
				minHeight: 44,
				alignItems: "center",
				justifyContent: "center",
				opacity: onPress ? 1 : 0.35,
			}}
		>
			<SymbolView
				name={{
					ios: glyph,
					android: glyph === "chevron.left" ? "chevron_left" : "chevron_right",
					web: glyph === "chevron.left" ? "chevron_left" : "chevron_right",
				}}
				size={17}
				weight="semibold"
				tintColor={colors.text}
			/>
		</Pressable>
	);
	return (
		<NutritionKeyboardOverlay>
			{label ? (
				<View
					style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}
				>
					<GlassSurface
						capsule
						style={{
							flexDirection: "row",
							alignItems: "center",
							paddingLeft: spacing.md,
							paddingRight: 6,
							minHeight: 52,
						}}
					>
						<AppText variant="footnote" numberOfLines={1} style={{ flex: 1 }}>
							{label}
						</AppText>
						{step(previousLabel, "chevron.left", onPrevious)}
						{step(nextLabel, "chevron.right", onNext)}
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={doneLabel}
							onPress={() => Keyboard.dismiss()}
							style={{
								minHeight: 40,
								paddingHorizontal: spacing.md,
								marginLeft: spacing.xs,
								borderRadius: radius.pill,
								backgroundColor: colors.accentFill,
								justifyContent: "center",
							}}
						>
							<AppText
								variant="footnote"
								style={{ color: colors.onAccent, fontWeight: "700" }}
							>
								{doneLabel}
							</AppText>
						</Pressable>
					</GlassSurface>
				</View>
			) : null}
		</NutritionKeyboardOverlay>
	);
}
