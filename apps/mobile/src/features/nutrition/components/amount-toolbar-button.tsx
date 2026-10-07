import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { Pressable } from "react-native";
import { radius, spacing, useTokens } from "../../../theme";
import { GlassSurface } from "../../../ui/glass-surface";
import { AppText } from "../../../ui/text";

/**
 * A glass button in an amount editor's bottom toolbar, such as "Replace…" or
 * the trash. `iconOnly` keeps the label for VoiceOver alone.
 */
export function AmountToolbarButton({
	label,
	symbol,
	onPress,
	disabled = false,
	destructive = false,
	iconOnly = false,
}: {
	label: string;
	symbol: ComponentProps<typeof SymbolView>["name"];
	onPress: () => void;
	disabled?: boolean;
	destructive?: boolean;
	iconOnly?: boolean;
}) {
	const colors = useTokens();
	return (
		<GlassSurface capsule>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityState={{ disabled }}
				disabled={disabled}
				onPress={onPress}
				style={{
					minWidth: 48,
					minHeight: 48,
					paddingHorizontal: iconOnly ? 0 : spacing.md,
					borderRadius: radius.pill,
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					gap: 6,
					opacity: disabled ? 0.4 : 1,
				}}
			>
				<SymbolView
					name={symbol}
					size={iconOnly ? 22 : 18}
					tintColor={destructive ? colors.danger : colors.text}
				/>
				{iconOnly ? null : (
					<AppText style={{ color: colors.text }}>{label}</AppText>
				)}
			</Pressable>
		</GlassSurface>
	);
}
