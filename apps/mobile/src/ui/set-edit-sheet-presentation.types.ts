export const SET_TYPES = ["warmup", "working", "drop", "failure"] as const;
export type SetType = (typeof SET_TYPES)[number];

export interface SetEditSheetPresentationProps {
	setNumber: number;
	exerciseName: string;
	weight: number;
	reps: number;
	setType: SetType;
	weightStep: number;
	busy: boolean;
	dirty: boolean;
	onWeightChange: (value: number) => void;
	onRepsChange: (value: number) => void;
	onSetTypeChange: (value: SetType) => void;
	onRequestClose: () => void;
	onSave: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
}
