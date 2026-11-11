import type { Equipment, ExerciseCategory } from "../exercise";

export type DefaultExercise = {
	_id: string;
	name: string;
	muscleGroups: string[];
	category: ExerciseCategory;
	equipment: Equipment;
	weightIncrement?: number;
	notes?: string;
	instructions: string[];
};
