import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../../theme";
import { EmptyState } from "../../../../ui/empty-state";
import { AppText } from "../../../../ui/text";
import type { LogFoodCopy } from "../log-food-copy";
import type { FoodFilter } from "../log-food-selection";

/**
 * What the list says when it has nothing to show.
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
			<View>
				<EmptyState
					title={copy.noResultsTitle(term)}
					body={copy.noResultsBody}
					appearance="search"
				/>
				<ActionCard
					actions={[
						...(offPending
							? [
									{
										key: "off",
										symbol: "globe" as const,
										label: copy.searchOnline,
										onPress: onSearchOnline,
									},
								]
							: []),
						{
							key: "create",
							symbol: "square.and.pencil" as const,
							label: copy.newFoodNamed(term),
							onPress: () => onCreateFood(term),
						},
					]}
				/>
			</View>
		);
	if (tab === "pool")
		return <EmptyState title={copy.poolEmptyTitle} body={copy.poolEmptyBody} />;
	if (tab === "recent")
		return (
			<EmptyState title={copy.recentEmptyTitle} body={copy.recentEmptyBody} />
		);
	if (tab === "favorites")
		return (
			<EmptyState
				title={copy.favoritesEmptyTitle}
				body={copy.favoritesEmptyBody}
			/>
		);
	if (tab === "combos")
		return (
			<EmptyState title={copy.combosEmptyTitle} body={copy.combosEmptyBody} />
		);
	if (tab === "recipes")
		return (
			<EmptyState title={copy.recipesEmptyTitle} body={copy.recipesEmptyBody} />
		);
	return <EmptyState title={copy.noFoodsTitle} body={copy.noFoodsBody} />;
}

const ANDROID_SYMBOLS = {
	globe: "public",
	"square.and.pencil": "edit",
} as const;

function ActionCard({
	actions,
}: {
	actions: readonly {
		key: string;
		symbol: keyof typeof ANDROID_SYMBOLS;
		label: string;
		onPress: () => void;
	}[];
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.card}>
			{actions.map((action, index) => (
				<Pressable
					key={action.key}
					accessibilityRole="button"
					onPress={action.onPress}
					style={[styles.action, index > 0 && styles.divided]}
				>
					<SymbolView
						name={{
							ios: action.symbol,
							android: ANDROID_SYMBOLS[action.symbol],
							web: ANDROID_SYMBOLS[action.symbol],
						}}
						size={18}
						tintColor={colors.accentInk}
					/>
					<AppText style={styles.label}>{action.label}</AppText>
				</Pressable>
			))}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		card: {
			marginHorizontal: spacing.md,
			borderRadius: radius.contentCard,
			backgroundColor: colors.surface,
			overflow: "hidden",
		},
		action: {
			minHeight: 48,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			paddingHorizontal: spacing.md,
		},
		divided: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		label: { flex: 1, color: colors.accentInk, fontWeight: "600" },
	});
