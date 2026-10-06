import { FoodVisualView } from "../../../../ui/food-visual";
import { type RowAction, SwipeableRow } from "../../../../ui/swipeable-row";
import { offProductCaption } from "../log-food-captions";
import type { FoodSelection } from "../log-food-selection";
import { LogFoodMediaSlot, MEDIA_SLOT } from "./log-food-media-slot";
import { LogFoodRowLayout } from "./log-food-row-layout";

/**
 * One food in the results.
 *
 * Tap opens the portion sheet, + logs the remembered portion. Swipe reveals
 * only Favorite and never commits on a full swipe; long press opens the whole
 * action set (log, other portion, favorite, then correct or edit/delete), and
 * screen readers get the same set as custom actions.
 */
export function LogFoodRow({
	selection,
	caption,
	energy,
	locale,
	quickLabel,
	quickPortion,
	quickLogging,
	actions,
	closeMenuLabel,
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
	actions: readonly RowAction[];
	closeMenuLabel: string;
	onPress: () => void;
	onQuickLog: () => void;
}) {
	const name = selection.food.name[locale];
	const legacyImageUrl =
		selection.kind === "personal" &&
		selection.food.visualMigrationPending &&
		!selection.food.visual
			? selection.food.provenance.imageUrl
			: undefined;
	const leading =
		selection.kind === "personal" && !legacyImageUrl ? (
			<FoodVisualView
				visual={selection.food.visual}
				label={name}
				size={MEDIA_SLOT}
			/>
		) : (
			<LogFoodMediaSlot
				imageUrl={legacyImageUrl}
				label={name}
				symbol={{ ios: "fork.knife", android: "restaurant", web: "restaurant" }}
			/>
		);
	return (
		<SwipeableRow
			actions={actions}
			menuTitle={name}
			closeMenuLabel={closeMenuLabel}
		>
			{(accessibility) => (
				<LogFoodRowLayout
					leading={leading}
					title={name}
					caption={
						selection.kind === "personal"
							? offProductCaption(selection.food.provenance, caption)
							: caption
					}
					energy={energy}
					portion={quickPortion}
					onPress={onPress}
					onLongPress={accessibility.onLongPress}
					accessibilityActions={accessibility.accessibilityActions}
					onAccessibilityAction={accessibility.onAccessibilityAction}
					add={{ label: quickLabel, busy: quickLogging, onPress: onQuickLog }}
				/>
			)}
		</SwipeableRow>
	);
}
