/**
 * PROTOTYPE — #46. The exercise library as variant B reaches it: a tab root,
 * so there is nothing to go back to and no back affordance is drawn.
 */
import { ExercisesScreen } from "../../../src/prototype/exercises-screen";

export default function BExercises() {
	return <ExercisesScreen showBack={false} />;
}
