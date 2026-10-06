import { EmptyState } from "../../../../ui/empty-state";
import type { nutritionFoodBrowserCopy } from "../log-food-copy";
import type { FoodFilter } from "../log-food-selection";

export function LogFoodEmptyState({
	tab,
	query,
	copy,
}: {
	tab: FoodFilter;
	query: string;
	copy: ReturnType<typeof nutritionFoodBrowserCopy>;
}) {
	if (query.trim())
		return (
			<EmptyState
				title={copy.noFoodsTitle}
				body={copy.noFoodsBody}
				appearance="search"
			/>
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
