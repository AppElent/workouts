import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { useExercise } from "../../src/data/exercises";
import { useI18n } from "../../src/i18n";
import { AddExerciseForm } from "../../src/screens/add-exercise-form";
import { EmptyState } from "../../src/ui/empty-state";
import { SkeletonList } from "../../src/ui/skeleton";

export default function NewExerciseRoute() {
	const router = useRouter();
	const { t } = useI18n();
	const { edit, clone, returnTo } = useLocalSearchParams<{
		edit?: string;
		clone?: string;
		returnTo?: string;
	}>();
	const sourceId = edit ?? clone;
	const exercise = useExercise(sourceId);
	if (sourceId && exercise === undefined)
		return (
			<View style={{ padding: 16 }}>
				<SkeletonList rows={5} />
			</View>
		);
	if (sourceId && (!exercise || (edit && exercise.isDefault)))
		return (
			<EmptyState
				title={t.exercises.noResults}
				body={t.exercises.unavailable}
				action={{ label: t.exercises.cancel, onPress: () => router.back() }}
			/>
		);
	return (
		<AddExerciseForm
			key={sourceId ?? "new"}
			presentation="screen"
			mode={edit ? "edit" : clone ? "clone" : "new"}
			exercise={exercise ?? undefined}
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

export { ExerciseRouteError as ErrorBoundary } from "../../src/screens/exercise-library/route-error";
