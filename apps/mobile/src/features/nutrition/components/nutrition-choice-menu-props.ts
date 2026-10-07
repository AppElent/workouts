import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type { SFSymbol } from "../../../ui/inset-list.types";

export type NutritionChoiceMenuItem = {
	id: string;
	label: string;
	/** A second, quieter line under the label. */
	hint?: string;
	/** Set for choices: shows a checkmark when true. Omit for plain actions. */
	selected?: boolean;
	destructive?: boolean;
	/** An SF Symbol before the label, as in system menus. */
	symbol?: SFSymbol;
	/**
	 * A nested menu (iOS) of further choices, such as the icon presets. Where
	 * menus cannot nest, its items follow as their own section.
	 */
	submenu?: readonly NutritionChoiceMenuItem[];
};

/** A visible menu trigger whose items are the row's or section's actions. */
export type NutritionChoiceMenuProps = {
	accessibilityLabel: string;
	title?: string;
	sections: readonly (readonly NutritionChoiceMenuItem[])[];
	onSelect: (id: string) => void;
	disabled?: boolean;
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
};
