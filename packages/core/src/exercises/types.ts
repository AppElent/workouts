import type { Equipment, ExerciseCategory, ExerciseMeasure } from "../exercise";

export type DefaultExercise = {
	_id: string;
	name: string;
	muscleGroups: string[];
	category: ExerciseCategory;
	equipment: Equipment;
	weightIncrement?: number;
	/** Personal Exercises only; shipped holds are named by id. Absent counts reps. */
	measure?: ExerciseMeasure;
	notes?: string;
	instructions: string[];
};
