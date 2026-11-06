import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fmt, type Messages } from "../../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../../theme";
import { AppText } from "../../../../ui/text";
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
const SPARKLES: Symbol = {
	ios: "sparkles",
	android: "auto_awesome",
	web: "auto_awesome",
};
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
	onDescribe,
}: {
	tab: FoodFilter;
	query: string;
	copy: Messages["nutrition"]["logFood"];
	/** Open Food Facts has not been asked about this query yet. */
	offPending: boolean;
	onSearchOnline: () => void;
	onCreateFood: (name: string) => void;
	/** Hulp bij invoeren with the query as its description. */
	onDescribe?: () => void;
}) {
	const term = query.trim();
	if (term)
		return (
			<EmptyCard
				symbol={SEARCH}
				title={fmt(copy.noResultsTitle, { query: term })}
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
						label: fmt(copy.newFoodNamed, { query: term }),
						onPress: () => onCreateFood(term),
					},
					...(onDescribe
						? [
								{
									key: "describe",
									symbol: SPARKLES,
									label: fmt(copy.describeQuery, { query: term }),
									hint: copy.describeQueryHint,
									highlight: true,
									onPress: onDescribe,
								},
							]
						: []),
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
		hint?: string;
		highlight?: boolean;
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
					style={[styles.action, action.highlight && styles.highlight]}
				>
					<SymbolView
						name={action.symbol}
						size={17}
						tintColor={colors.accentInk}
					/>
					<View style={styles.actionText}>
						<AppText style={styles.actionLabel}>{action.label}</AppText>
						{action.hint ? (
							<AppText variant="caption">{action.hint}</AppText>
						) : null}
					</View>
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
		actionText: { flex: 1, paddingVertical: spacing.sm },
		actionLabel: { color: colors.accentInk, fontWeight: "600" },
		highlight: { backgroundColor: colors.accentDim },
	});

/**
 * Under search results: none of them may be what was eaten (“broodje kip”
 * finds NEVO sandwiches, not the store's one), so Hulp is one tap away.
 */
export function LogFoodDescribeRow({
	query,
	copy,
	onPress,
}: {
	query: string;
	copy: Messages["nutrition"]["logFood"];
	onPress: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.card}>
			<Pressable
				accessibilityRole="button"
				onPress={onPress}
				style={[styles.action, styles.highlight, { borderTopWidth: 0 }]}
			>
				<SymbolView name={SPARKLES} size={17} tintColor={colors.accentInk} />
				<View style={styles.actionText}>
					<AppText style={styles.actionLabel}>
						{fmt(copy.describeQuery, { query: query.trim() })}
					</AppText>
				</View>
			</Pressable>
		</View>
	);
}
