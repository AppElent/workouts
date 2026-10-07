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
import { AppText } from "../../../../ui/text";
import type { LogFoodCopy } from "../log-food-copy";
import type { FoodFilter } from "../log-food-selection";

type Symbol = ComponentProps<typeof SymbolView>["name"];

const SEARCH: Symbol = {
	ios: "magnifyingglass",
	android: "search",
	web: "search",
};
const FORK: Symbol = {
	ios: "fork.knife",
	android: "restaurant",
	web: "restaurant",
};
const GLOBE: Symbol = { ios: "globe", android: "public", web: "public" };
const NEW_FOOD: Symbol = {
	ios: "square.and.pencil",
	android: "edit",
	web: "edit",
};

/**
 * What the list says when it has nothing to show, as one card (design
 * `.empty`): an icon tile, a title, a line of help, and the next steps as rows
 * inside the same card.
 *
 * A query with no local match is never a dead end: it points at Open Food
 * Facts (until that has been asked) and at creating the food under the name
 * that was typed. Without a query, each scope explains how it fills up.
 */
export function LogFoodEmptyState({
	tab,
	query,
	copy,
	offPending,
	onSearchOnline,
	onCreateFood,
}: {
	tab: FoodFilter;
	query: string;
	copy: LogFoodCopy;
	/** Open Food Facts has not been asked about this query yet. */
	offPending: boolean;
	onSearchOnline: () => void;
	onCreateFood: (name: string) => void;
}) {
	const term = query.trim();
	if (term)
		return (
			<EmptyCard
				symbol={SEARCH}
				title={copy.noResultsTitle(term)}
				body={copy.noResultsBody}
				actions={[
					...(offPending
						? [
								{
									key: "off",
									symbol: GLOBE,
									label: copy.searchOnline,
									onPress: onSearchOnline,
								},
							]
						: []),
					{
						key: "create",
						symbol: NEW_FOOD,
						label: copy.newFoodNamed(term),
						onPress: () => onCreateFood(term),
					},
				]}
			/>
		);
	const [title, body] =
		tab === "pool"
			? [copy.poolEmptyTitle, copy.poolEmptyBody]
			: tab === "recent"
				? [copy.recentEmptyTitle, copy.recentEmptyBody]
				: tab === "favorites"
					? [copy.favoritesEmptyTitle, copy.favoritesEmptyBody]
					: tab === "combos"
						? [copy.combosEmptyTitle, copy.combosEmptyBody]
						: tab === "recipes"
							? [copy.recipesEmptyTitle, copy.recipesEmptyBody]
							: [copy.noFoodsTitle, copy.noFoodsBody];
	return <EmptyCard symbol={FORK} title={title} body={body} actions={[]} />;
}

function EmptyCard({
	symbol,
	title,
	body,
	actions,
}: {
	symbol: Symbol;
	title: string;
	body: string;
	actions: readonly {
		key: string;
		symbol: Symbol;
		label: string;
		onPress: () => void;
	}[];
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.card}>
			<View style={styles.empty}>
				<View style={styles.icon}>
					<SymbolView name={symbol} size={24} tintColor={colors.accentInk} />
				</View>
				<AppText
					variant="heading"
					accessibilityRole="header"
					style={styles.center}
				>
					{title}
				</AppText>
				<AppText variant="secondary" style={[styles.center, styles.muted]}>
					{body}
				</AppText>
			</View>
			{actions.map((action) => (
				<Pressable
					key={action.key}
					accessibilityRole="button"
					onPress={action.onPress}
					style={styles.action}
				>
					<SymbolView
						name={action.symbol}
						size={17}
						tintColor={colors.accentInk}
					/>
					<AppText style={styles.actionLabel}>{action.label}</AppText>
				</Pressable>
			))}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		card: {
			marginHorizontal: spacing.md,
			marginTop: spacing.md,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
			backgroundColor: colors.surface,
			overflow: "hidden",
		},
		empty: {
			alignItems: "center",
			gap: 4,
			paddingHorizontal: 26,
			paddingTop: 26,
			paddingBottom: 18,
		},
		icon: {
			width: 56,
			height: 56,
			marginBottom: 8,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: 18,
			borderCurve: "continuous",
			backgroundColor: colors.accentDim,
		},
		center: { textAlign: "center" },
		muted: { color: colors.textMuted },
		action: {
			minHeight: 50,
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			paddingHorizontal: spacing.md,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		actionLabel: { flex: 1, color: colors.accentInk, fontWeight: "600" },
	});
