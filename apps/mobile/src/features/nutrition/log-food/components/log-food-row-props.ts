import type { RowAction } from "../../../../ui/swipeable-row";
import type { FoodRowPosition } from "../../components/food-row-layout";
import type { FoodSelection } from "../log-food-selection";

/** One food in the results; shared by the iOS and the cross-platform row. */
export interface LogFoodRowProps {
	selection: FoodSelection;
	/** Source and per-100 figure, such as "NEVO · 151 kcal/100 g". */
	caption: string;
	locale: "en" | "nl";
	position: FoodRowPosition;
	quickLabel: string;
	/** kcal of the remembered portion, such as "97 kcal". */
	quickValue: string | undefined;
	/** The remembered portion, such as "1 stuk". */
	quickPortion: string | undefined;
	quickLogging: boolean;
	/** The row was just logged with +; the button shows ✓ for a moment. */
	justLogged: boolean;
	actions: readonly RowAction[];
	closeMenuLabel: string;
	onPress: () => void;
	/** Absent when a tap is the only way in, such as when replacing: a chevron shows. */
	onQuickLog?: () => void;
}
