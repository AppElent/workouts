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
} from "../../../theme";
import { AppText } from "../../../ui/text";

/** Where a row sits in its grouped card, which decides its corners and separator. */
export type FoodRowPosition = "only" | "first" | "middle" | "last";

/** The corners a cell at `position` rounds, so a group of rows reads as one card. */
export function foodCellCorners(position: FoodRowPosition) {
	const top = position === "only" || position === "first";
	const bottom = position === "only" || position === "last";
	return {
		borderTopLeftRadius: top ? radius.contentCard : 0,
		borderTopRightRadius: top ? radius.contentCard : 0,
		borderBottomLeftRadius: bottom ? radius.contentCard : 0,
		borderBottomRightRadius: bottom ? radius.contentCard : 0,
	};
}

/** Leading inset of the separator: the row's padding plus the 38pt tile and gap. */
const SEPARATOR_INSET = spacing.md + 38 + 12;

/**
 * The grid every result row shares, drawn as one row of a white grouped card
 * (design `.card` + `.qrow`): tile, name over caption, the logged amount's
 * kcal over its portion, then a round + — or a chevron for proposals.
 *
 * The + is its own hit target, separate from the row: tapping the row opens
 * the portion, tapping + logs at once. After a log it briefly shows ✓.
 */
export function FoodRowLayout({
	leading,
	title,
	caption,
	value,
	portion,
	position = "only",
	inset = true,
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
	/** The figure on the right, such as "97 kcal". */
	value?: string;
	/** What `value` is for, such as "1 stuk". */
	portion?: string;
	position?: FoodRowPosition;
	/** False when a wrapper (a swipeable cell) already insets and rounds the row. */
	inset?: boolean;
	rowLabel?: string;
	onPress: () => void;
	onLongPress?: () => void;
	accessibilityActions?: readonly { name: string; label: string }[];
	onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
	add?: {
		readonly label: string;
		readonly busy?: boolean;
		readonly done?: boolean;
		readonly onPress: () => void;
	};
	chevron?: boolean;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View
			style={[
				styles.row,
				inset && styles.inset,
				inset && foodCellCorners(position),
			]}
		>
			{position === "middle" || position === "last" ? (
				<View style={styles.separator} />
			) : null}
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
				<View style={styles.text}>
					{/*
					 * Two lines, not one: NEVO names run long in Dutch
					 * ("Aardappel(product) naturel voorgekookt koelvers") and a hard
					 * one-line clamp hides the part that distinguishes them.
					 */}
					<AppText numberOfLines={2} style={styles.title}>
						{title}
					</AppText>
					<AppText variant="caption" numberOfLines={2}>
						{caption}
					</AppText>
				</View>
				{value || portion ? (
					<View style={styles.amount}>
						{value ? (
							<AppText variant="label" style={styles.value}>
								{value}
							</AppText>
						) : null}
						{portion ? (
							<AppText variant="caption" numberOfLines={1}>
								{portion}
							</AppText>
						) : null}
					</View>
				) : null}
			</Pressable>
			{add ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={add.label}
					accessibilityState={{ busy: add.busy, disabled: add.busy }}
					disabled={add.busy}
					hitSlop={5}
					onPress={add.onPress}
					style={styles.add}
				>
					<SymbolView
						name={
							add.done
								? { ios: "checkmark", android: "check", web: "check" }
								: { ios: "plus", android: "add", web: "add" }
						}
						size={16}
						weight="bold"
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
					size={13}
					weight="semibold"
					tintColor={colors.textFaint}
				/>
			) : null}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		row: {
			minHeight: 58,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingLeft: spacing.md,
			paddingRight: 12,
			paddingVertical: 10,
			backgroundColor: colors.surface,
		},
		inset: { marginHorizontal: spacing.md, borderCurve: "continuous" },
		separator: {
			position: "absolute",
			top: 0,
			left: SEPARATOR_INSET,
			right: 0,
			height: StyleSheet.hairlineWidth,
			backgroundColor: colors.separator,
		},
		open: {
			flex: 1,
			minWidth: 0,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
		},
		text: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
		title: { fontWeight: "500" },
		amount: { alignItems: "flex-end", flexShrink: 0, maxWidth: 110 },
		value: { color: colors.text, fontVariant: ["tabular-nums"] },
		add: {
			width: 34,
			height: 34,
			flexGrow: 0,
			flexShrink: 0,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.pill,
			backgroundColor: colors.accentFill,
		},
	});
