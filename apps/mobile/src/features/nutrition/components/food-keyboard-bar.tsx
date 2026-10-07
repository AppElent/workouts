import { SymbolView } from "expo-symbols";
import { Keyboard, Pressable, View } from "react-native";
import { radius, spacing, useTokens } from "../../../theme";
import { GlassSurface } from "../../../ui/glass-surface";
import { AppText } from "../../../ui/text";
import { NutritionKeyboardOverlay } from "./nutrition-keyboard-overlay";

/** Trace and Unknown replace the per-row menus; ‹ › walk the values in order. */
export function FoodKeyboardBar({
	visible,
	traceLabel,
	unknownLabel,
	previousLabel,
	nextLabel,
	doneLabel,
	onTrace,
	onUnknown,
	onPrevious,
	onNext,
}: {
	visible: boolean;
	traceLabel: string;
	unknownLabel: string;
	previousLabel: string;
	nextLabel: string;
	doneLabel: string;
	/** Absent where a value cannot be a trace or unknown, such as an amount. */
	onTrace?: () => void;
	onUnknown?: () => void;
	onPrevious?: () => void;
	onNext?: () => void;
}) {
	const colors = useTokens();
	const chip = (label: string, onPress: () => void) => (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			style={({ pressed }) => ({
				minHeight: 38,
				paddingHorizontal: 12,
				borderRadius: radius.pill,
				justifyContent: "center",
				backgroundColor: pressed ? colors.surface2 : colors.surface,
			})}
		>
			<AppText
				variant="footnote"
				style={{ fontWeight: "600", color: colors.text }}
			>
				{label}
			</AppText>
		</Pressable>
	);
	const step = (
		label: string,
		glyph: "chevron.left" | "chevron.right",
		onPress?: () => void,
	) => (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: !onPress }}
			disabled={!onPress}
			onPress={onPress}
			style={{
				minWidth: 40,
				minHeight: 40,
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
				size={16}
				weight="semibold"
				tintColor={colors.text}
			/>
		</Pressable>
	);
	return (
		<NutritionKeyboardOverlay>
			{visible ? (
				<View
					style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}
				>
					<GlassSurface
						capsule
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 6,
							paddingHorizontal: 6,
							minHeight: 52,
						}}
					>
						{onTrace ? chip(traceLabel, onTrace) : null}
						{onUnknown ? chip(unknownLabel, onUnknown) : null}
						<View style={{ flex: 1 }} />
						{step(previousLabel, "chevron.left", onPrevious)}
						{step(nextLabel, "chevron.right", onNext)}
						<Pressable
							accessibilityRole="button"
							onPress={() => Keyboard.dismiss()}
							style={{
								minHeight: 40,
								paddingHorizontal: spacing.md,
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
