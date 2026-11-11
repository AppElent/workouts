import { useLocalSearchParams, useRouter } from "expo-router";
import { ExerciseEditorScreen } from "../../src/features/training/exercises/exercise-editor-screen";

export default function NewExerciseRoute() {
	const router = useRouter();
	const { edit, clone, returnTo } = useLocalSearchParams<{
		edit?: string;
		clone?: string;
		returnTo?: string;
	}>();
	return (
		<ExerciseEditorScreen
			mode={edit ? "edit" : clone ? "clone" : "new"}
			sourceId={edit ?? clone}
			onClose={(createdName) =>
				createdName && (!edit || returnTo === "library")
					? router.dismissTo({
							pathname: "/exercises",
							params: { created: createdName },
						})
					: router.back()
			}
		/>
	);
}

export { TrainingRouteError as ErrorBoundary } from "../../src/features/training/components/training-route-error";
