import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../../theme";
import { FoodVisualView } from "../../../../ui/food-visual";
import { AppText } from "../../../../ui/text";
import { offProductCaption } from "../log-food-captions";
import type { FoodSelection } from "../log-food-selection";

/**
 * The 44pt slot every row leads with.
 *
 * Drawn even when a food has no photo and no preset, because the alternative —
 * what the screen used to do — was three different leading indents and titles
 * that never lined up.
 */
/**
 * Every row leads with a slot this wide, drawn whether or not the food has a
 * picture, so titles line up at one indent instead of three.
 */
export const MEDIA_SLOT = 44;

export function LogFoodMediaSlot({
	symbol,
	tinted = false,
}: {
	symbol: ComponentProps<typeof SymbolView>["name"];
	tinted?: boolean;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.mediaSlot}>
			<SymbolView
				name={symbol}
				size={20}
				tintColor={tinted ? colors.accentInk : colors.textFaint}
			/>
		</View>
	);
}

export function LogFoodRow({
	selection,
	caption,
	energy,
	locale,
	quickLabel,
	quickPortion,
	quickLogging,
	onPress,
	onQuickLog,
}: {
	selection: FoodSelection;
	caption: string;
	energy: string;
	locale: "en" | "nl";
	quickLabel: string;
	quickPortion: string | undefined;
	quickLogging: boolean;
	onPress: () => void;
	onQuickLog: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const legacyImageUrl =
		selection.kind === "personal" &&
		selection.food.visualMigrationPending &&
		!selection.food.visual
			? selection.food.provenance.imageUrl
			: undefined;
	return (
		<View style={styles.foodRow}>
			<Pressable
				accessibilityRole="button"
				onPress={onPress}
				style={styles.foodOpen}
			>
				{legacyImageUrl ? (
					<Image
						source={legacyImageUrl}
						accessibilityLabel={selection.food.name[locale]}
						cachePolicy="memory-disk"
						contentFit="contain"
						style={styles.foodImage}
					/>
				) : selection.kind === "personal" ? (
					<FoodVisualView
						visual={selection.food.visual}
						label={selection.food.name[locale]}
						size={MEDIA_SLOT}
					/>
				) : (
					<LogFoodMediaSlot
						symbol={{
							ios: "fork.knife",
							android: "restaurant",
							web: "restaurant",
						}}
					/>
				)}
				<View style={styles.flex}>
					{/*
					 * Two lines, not one: NEVO names run long in Dutch
					 * ("Aardappel(product) naturel voorgekookt koelvers") and a hard
					 * one-line clamp hides the part that distinguishes them. Two is
					 * enough for almost all of them and still bounds the row.
					 */}
					<AppText numberOfLines={2} style={styles.rowTitle}>
						{selection.food.name[locale]}
					</AppText>
					<AppText variant="caption">
						{selection.kind === "personal"
							? offProductCaption(selection.food.provenance, caption)
							: caption}
					</AppText>
					<AppText variant="caption" style={styles.rowFaint}>
						{energy}
					</AppText>
				</View>
			</Pressable>
			{quickPortion ? (
				<AppText variant="caption" style={styles.quickPortion}>
					{quickPortion}
				</AppText>
			) : null}
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={quickLabel}
				accessibilityState={{ busy: quickLogging, disabled: quickLogging }}
				disabled={quickLogging}
				onPress={onQuickLog}
				style={styles.quickAdd}
			>
				<SymbolView
					name={{ ios: "plus", android: "add", web: "add" }}
					size={18}
					tintColor={colors.onAccent}
				/>
			</Pressable>
		</View>
	);
}

/** A Combo, on the same grid as a food: media slot, three lines, round +. */
export function LogFoodComboRow({
	name,
	caption,
	energy,
	portion,
	detailLabel,
	onDetail,
	logLabel,
	onLog,
}: {
	name: string;
	caption: string;
	energy?: string;
	portion?: string;
	detailLabel: string;
	onDetail: () => void;
	logLabel: string;
	onLog: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.foodRow}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={detailLabel}
				onPress={onDetail}
				style={styles.foodOpen}
			>
				<LogFoodMediaSlot
					symbol={{
						ios: "square.stack.3d.up",
						android: "layers",
						web: "layers",
					}}
				/>
				<View style={styles.flex}>
					<AppText numberOfLines={2} style={styles.rowTitle}>
						{name}
					</AppText>
					<AppText variant="caption">{caption}</AppText>
					{energy ? (
						<AppText variant="caption" style={styles.rowFaint}>
							{energy}
						</AppText>
					) : null}
				</View>
			</Pressable>
			{portion ? (
				<AppText variant="caption" style={styles.quickPortion}>
					{portion}
				</AppText>
			) : null}
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${logLabel} ${name}`}
				onPress={onLog}
				style={styles.quickAdd}
			>
				<SymbolView
					name={{ ios: "plus", android: "add", web: "add" }}
					size={18}
					tintColor={colors.onAccent}
				/>
			</Pressable>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		flex: { flex: 1 },
		rowTitle: { fontWeight: "600", letterSpacing: -0.2 },
		rowFaint: { color: colors.textFaint },
		foodRow: {
			minHeight: 64,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: spacing.md,
			paddingVertical: 10,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: colors.separator,
		},
		foodOpen: {
			flex: 1,
			minWidth: 0,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
		},
		mediaSlot: {
			width: MEDIA_SLOT,
			height: MEDIA_SLOT,
			flexGrow: 0,
			flexShrink: 0,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
		foodImage: {
			width: MEDIA_SLOT,
			height: MEDIA_SLOT,
			flexGrow: 0,
			flexShrink: 0,
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
		quickAdd: {
			width: 44,
			height: 44,
			flexGrow: 0,
			flexShrink: 0,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.pill,
			backgroundColor: colors.accentFill,
		},
		quickPortion: {
			maxWidth: 104,
			color: colors.textMuted,
			textAlign: "right",
			fontVariant: ["tabular-nums"],
		},
	});
