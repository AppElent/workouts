import { View } from "react-native";
import { useExercise } from "../../../data/exercises";
import { useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { EmptyState } from "../../../ui/empty-state";
import { SkeletonList } from "../../../ui/skeleton";
import { ExerciseEditorForm } from "./exercise-editor-form";

/** A new exercise, or an edit or copy of `sourceId`. Shipped exercises are copied, never edited. */
export function ExerciseEditorScreen({
	mode,
	sourceId,
	onClose,
}: {
	mode: "new" | "edit" | "clone";
	sourceId?: string;
	onClose: (createdName?: string) => void;
}) {
	const { t } = useI18n();
	const exercise = useExercise(sourceId);
	if (sourceId && exercise === undefined)
		return (
			<View style={{ padding: spacing.md }}>
				<SkeletonList rows={5} />
			</View>
		);
	if (sourceId && (!exercise || (mode === "edit" && exercise.isDefault)))
		return (
			<EmptyState
				title={t.exercises.noResults}
				body={t.exercises.unavailable}
				action={{ label: t.exercises.cancel, onPress: () => onClose() }}
			/>
		);
	return (
		<ExerciseEditorForm
			key={sourceId ?? "new"}
			mode={mode}
			exercise={exercise ?? undefined}
			onClose={onClose}
		/>
	);
}
