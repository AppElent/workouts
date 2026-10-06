import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import {
	type AccessibilityActionEvent,
	Pressable,
	StyleSheet,
	View,
} from "react-native";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../../theme";
import { AppText } from "../../../../ui/text";

/**
 * The grid every result row shares: media slot, up to three lines, then an
 * optional portion and either a round + or a disclosure chevron.
 *
 * The + is its own hit target, separate from the row: tapping the row opens
 * the portion, tapping + logs at once.
 */
export function LogFoodRowLayout({
	leading,
	title,
	caption,
	energy,
	portion,
	rowLabel,
	onPress,
	onLongPress,
	accessibilityActions,
	onAccessibilityAction,
	add,
	chevron = false,
}: {
	leading: ReactNode;
	title: string;
	caption: string;
	energy?: string;
	portion?: string;
	rowLabel?: string;
	onPress: () => void;
	onLongPress?: () => void;
	accessibilityActions?: readonly { name: string; label: string }[];
	onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
	add?: {
		readonly label: string;
		readonly busy?: boolean;
		readonly onPress: () => void;
	};
	chevron?: boolean;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.row}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={rowLabel}
				accessibilityActions={accessibilityActions}
				onAccessibilityAction={onAccessibilityAction}
				onPress={onPress}
				onLongPress={onLongPress}
				style={styles.open}
			>
				{leading}
				<View style={styles.flex}>
					{/*
					 * Two lines, not one: NEVO names run long in Dutch
					 * ("Aardappel(product) naturel voorgekookt koelvers") and a hard
					 * one-line clamp hides the part that distinguishes them.
					 */}
					<AppText numberOfLines={2} style={styles.title}>
						{title}
					</AppText>
					<AppText variant="caption">{caption}</AppText>
					{energy ? (
						<AppText variant="caption" style={styles.faint}>
							{energy}
						</AppText>
					) : null}
				</View>
			</Pressable>
			{portion ? (
				<AppText variant="caption" style={styles.portion}>
					{portion}
				</AppText>
			) : null}
			{add ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={add.label}
					accessibilityState={{ busy: add.busy, disabled: add.busy }}
					disabled={add.busy}
					onPress={add.onPress}
					style={styles.add}
				>
					<SymbolView
						name={{ ios: "plus", android: "add", web: "add" }}
						size={18}
						tintColor={colors.onAccent}
					/>
				</Pressable>
			) : null}
			{chevron ? (
				<SymbolView
					name={{
						ios: "chevron.right",
						android: "chevron_right",
						web: "chevron_right",
					}}
					size={14}
					tintColor={colors.textFaint}
				/>
			) : null}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		flex: { flex: 1 },
		title: { fontWeight: "600", letterSpacing: -0.2 },
		faint: { color: colors.textFaint },
		row: {
			minHeight: 64,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: spacing.md,
			paddingVertical: 10,
			backgroundColor: colors.bg,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: colors.separator,
		},
		open: {
			flex: 1,
			minWidth: 0,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
		},
		add: {
			width: 44,
			height: 44,
			flexGrow: 0,
			flexShrink: 0,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.pill,
			backgroundColor: colors.accentFill,
		},
		portion: {
			maxWidth: 104,
			color: colors.textMuted,
			textAlign: "right",
			fontVariant: ["tabular-nums"],
		},
	});
