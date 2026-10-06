export type SelectionMenuProps = {
	label: string;
	accessibilityLabel: string;
	disabled?: boolean;
	groups: readonly {
		title?: string;
		options: readonly {
			id: string;
			label: string;
			selected?: boolean;
			emphasized?: boolean;
			symbol?: "plus";
			disabled?: boolean;
		}[];
	}[];
	onSelect: (id: string) => void;
};
