import { DEFAULT_EXERCISES } from "./exercises";
import type { DefaultExercise } from "./types";

// References can be a permanent shipped key or an existing Convex document ID.
export type ExerciseId = string;
export type Exercise = Omit<DefaultExercise, "instructions"> & {
	instructions?: string[];
	_creationTime: number;
	isDefault: boolean;
	userId?: string;
};
export const SHIPPED_EXERCISES: Exercise[] = DEFAULT_EXERCISES.map(
	(exercise) => ({
		...exercise,
		isDefault: true,
		_creationTime: 0,
	}),
);
const byId = new Map(
	SHIPPED_EXERCISES.map((exercise) => [exercise._id, exercise]),
);
export function getShippedExercise(id: string) {
	return byId.get(id);
}

export function mergeExerciseCatalog(personal: Exercise[]): Exercise[] {
	return [...SHIPPED_EXERCISES, ...personal].sort((a, b) =>
		a.name.localeCompare(b.name),
	);
}
