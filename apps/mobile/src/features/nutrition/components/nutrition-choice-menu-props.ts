import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export type NutritionChoiceMenuItem = {
	id: string;
	label: string;
	/** A second, quieter line under the label. */
	hint?: string;
	/** Set for choices: shows a checkmark when true. Omit for plain actions. */
	selected?: boolean;
	destructive?: boolean;
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
