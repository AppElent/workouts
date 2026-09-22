export type FoodVisualMenuProps<Value extends string> = {
	label: string;
	options: readonly { value: Value; label: string }[];
	selectedValue?: Value;
	onSelect: (value: Value) => void;
};
