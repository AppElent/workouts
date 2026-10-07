import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, View } from "react-native";
import { radius, spacing, useTokens } from "../../../theme";
import { GlassSurface } from "../../../ui/glass-surface";
import { AppText } from "../../../ui/text";

/**
 * ✕, the title and ✓ above an amount editor inside a React Native `Modal`,
 * which has no navigator and so no native header. Routed sheets use
 * `AmountSheetHeader`. ✓ fills once there is something to confirm.
 */
export function AmountEditorHeader({
	title,
	subtitle,
	closeLabel,
	confirmLabel,
	canConfirm,
	busy = false,
	busyLabel,
	disabled = false,
	onClose,
	onConfirm,
}: {
	title: string;
	subtitle?: string;
	closeLabel: string;
	confirmLabel: string;
	canConfirm: boolean;
	busy?: boolean;
	busyLabel?: string;
	disabled?: boolean;
	onClose: () => void;
	onConfirm: () => void;
}) {
	const colors = useTokens();
	const button = (
		label: string,
		glyph: "xmark" | "checkmark",
		onPress: () => void,
		off: boolean,
		prominent = false,
	) => (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: off }}
			disabled={off}
			onPress={onPress}
			style={{
				width: 44,
				height: 44,
				borderRadius: radius.pill,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: prominent ? colors.accentFill : undefined,
				opacity: off ? 0.4 : 1,
			}}
		>
			<SymbolView
				name={{
					ios: glyph,
					android: glyph === "xmark" ? "close" : "check",
					web: glyph === "xmark" ? "close" : "check",
				}}
				size={19}
				weight="semibold"
				tintColor={prominent ? colors.onAccent : colors.text}
			/>
		</Pressable>
	);
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				paddingHorizontal: spacing.sm,
				paddingTop: spacing.sm,
			}}
		>
			<GlassSurface capsule>
				{button(closeLabel, "xmark", onClose, busy || disabled)}
			</GlassSurface>
			<View
				style={{ flex: 1, alignItems: "center", marginHorizontal: spacing.sm }}
			>
				<AppText variant="navTitle" numberOfLines={1}>
					{title}
				</AppText>
				{subtitle ? (
					<AppText variant="caption" numberOfLines={1}>
						{subtitle}
					</AppText>
				) : null}
			</View>
			<GlassSurface capsule>
				{busy ? (
					<View style={{ width: 44, height: 44, justifyContent: "center" }}>
						<ActivityIndicator accessibilityLabel={busyLabel ?? confirmLabel} />
					</View>
				) : (
					button(
						confirmLabel,
						"checkmark",
						onConfirm,
						!canConfirm || disabled,
						canConfirm && !disabled,
					)
				)}
			</GlassSurface>
		</View>
	);
}
