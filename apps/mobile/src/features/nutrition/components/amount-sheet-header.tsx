import { Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useRef } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";

/**
 * ✕ and ✓ of a routed amount sheet as native header items (mobile-design
 * "Draft editor sheet"): UIKit draws and tints the glass. ✓ fills once there
 * is something to confirm and turns into progress while it runs. Older
 * systems fall back to plain header buttons.
 *
 * The options only change with what they show; the handlers are read from a
 * ref. `Stack.Screen` sets options whenever their identity changes, and a
 * sheet that re-renders on every options update would otherwise loop.
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
	const { text, accentFill, onAccent } = useTokens();
	const handlers = useRef({ onClose, onConfirm });
	handlers.current = { onClose, onConfirm };
	const confirmable = canConfirm && !disabled;
	const closeOff = busy || disabled;
	const options = useMemo(() => {
		const close = () => handlers.current.onClose();
		const confirm = () => handlers.current.onConfirm();
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
					backgroundColor: prominent ? accentFill : undefined,
				}}
			>
				<SymbolView
					name={{
						ios: glyph,
						android: glyph === "xmark" ? "close" : "check",
						web: glyph === "xmark" ? "close" : "check",
					}}
					size={20}
					tintColor={prominent ? onAccent : text}
				/>
			</Pressable>
		);
		return {
			title,
			headerShown: true,
			headerTitleStyle: { color: text },
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
			headerLeft: () => fallback(closeLabel, "xmark", close, closeOff, false),
			unstable_headerRightItems: () =>
				busy
					? [{ type: "custom" as const, element: progress }]
					: [
							{
								type: "button" as const,
								label: confirmLabel,
								accessibilityLabel: confirmLabel,
								icon: { type: "sfSymbol" as const, name: "checkmark" as const },
								variant: confirmable
									? ("prominent" as const)
									: ("plain" as const),
								tintColor: confirmable ? accentFill : text,
								disabled: !confirmable,
								onPress: confirm,
							},
						],
			headerRight: () =>
				busy
					? progress
					: fallback(
							confirmLabel,
							"checkmark",
							confirm,
							!confirmable,
							confirmable,
						),
		};
	}, [
		accentFill,
		busy,
		busyLabel,
		closeLabel,
		closeOff,
		confirmLabel,
		confirmable,
		onAccent,
		subtitle,
		text,
		title,
	]);
	return <Stack.Screen options={options} />;
}
