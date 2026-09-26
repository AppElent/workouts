import type { Exercise } from "@workouts/core/exercises";

const EQUIPMENT_STEPS: Record<Exercise["equipment"], number> = {
	barbell: 2.5,
	dumbbell: 1,
	cable: 5,
	machine: 5,
	kettlebell: 4,
	band: 2.5,
	bodyweight: 2.5,
	other: 2.5,
};

export function getWeightStep(
	equipment: Exercise["equipment"],
	weightIncrement?: number,
): number {
	return weightIncrement ?? EQUIPMENT_STEPS[equipment];
}
