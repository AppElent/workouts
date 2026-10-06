import type { ReactElement } from "react";
export interface GoalRowMenuProps {
	children: (onLongPress?: () => void) => ReactElement;
	onOpen: () => void;
	onSources?: () => void;
	onEdit: () => void;
	onReorder?: () => void;
	sourcesLabel: string;
	editLabel: string;
	reorderLabel: string;
	disabled: boolean;
}
export function GoalRowMenu({ children, onOpen, disabled }: GoalRowMenuProps) {
	return children(disabled ? undefined : onOpen);
}
