import { Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";

/**
 * ✕ and ✓ of a routed amount sheet as native header items (mobile-design
 * "Draft editor sheet"): UIKit draws and tints the glass. ✓ fills once there
 * is something to confirm and turns into progress while it runs. Older
 * systems fall back to plain header buttons.
 */
export function AmountSheetHeader({
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
	/** Locks both buttons, such as while a serving is being added. */
	disabled?: boolean;
	onClose: () => void;
	onConfirm: () => void;
}) {
	const colors = useTokens();
	const confirmable = canConfirm && !disabled;
	const progress = (
		<ActivityIndicator accessibilityLabel={busyLabel ?? confirmLabel} />
	);
	const fallback = (
		label: string,
		glyph: "xmark" | "checkmark",
		onPress: () => void,
		off: boolean,
		prominent: boolean,
	) => (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: off }}
			disabled={off}
			onPress={onPress}
			style={{
				minHeight: 44,
				minWidth: 44,
				alignItems: "center",
				justifyContent: "center",
				opacity: off ? 0.4 : 1,
				borderRadius: 22,
				backgroundColor: prominent ? colors.accentFill : undefined,
			}}
		>
			<SymbolView
				name={{
					ios: glyph,
					android: glyph === "xmark" ? "close" : "check",
					web: glyph === "xmark" ? "close" : "check",
				}}
				size={20}
				tintColor={prominent ? colors.onAccent : colors.text}
			/>
		</Pressable>
	);
	return (
		<Stack.Screen
			options={{
				title,
				headerShown: true,
				headerTitleStyle: { color: colors.text },
				...(subtitle
					? {
							headerTitle: () => (
								<View style={{ alignItems: "center" }}>
									<AppText variant="navTitle" numberOfLines={1}>
										{title}
									</AppText>
									<AppText variant="caption" numberOfLines={1}>
										{subtitle}
									</AppText>
								</View>
							),
						}
					: {}),
				unstable_headerLeftItems: () => [
					{
						type: "button",
						label: closeLabel,
						accessibilityLabel: closeLabel,
						icon: { type: "sfSymbol", name: "xmark" },
						disabled: busy || disabled,
						onPress: onClose,
					},
				],
				headerLeft: () =>
					fallback(closeLabel, "xmark", onClose, busy || disabled, false),
				unstable_headerRightItems: () =>
					busy
						? [{ type: "custom", element: progress }]
						: [
								{
									type: "button",
									label: confirmLabel,
									accessibilityLabel: confirmLabel,
									icon: { type: "sfSymbol", name: "checkmark" },
									variant: confirmable ? "prominent" : "plain",
									tintColor: confirmable ? colors.accentFill : colors.text,
									disabled: !confirmable,
									onPress: onConfirm,
								},
							],
				headerRight: () =>
					busy
						? progress
						: fallback(
								confirmLabel,
								"checkmark",
								onConfirm,
								!confirmable,
								confirmable,
							),
			}}
		/>
	);
}
