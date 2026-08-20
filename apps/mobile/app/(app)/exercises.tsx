/**
 * PROTOTYPE — #46. The exercise library as variants A and C reach it: pushed
 * onto the stack, so it gets a back affordance. Variant B mounts the same
 * screen as a tab root in `(tabs)/b-exercises.tsx`.
 */
import { ExercisesScreen } from "../../src/prototype/exercises-screen";

export default function Exercises() {
	return <ExercisesScreen showBack />;
}
