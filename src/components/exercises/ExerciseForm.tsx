import { api } from "@convex/_generated/api";
import {
	EQUIPMENT,
	type Equipment,
	EXERCISE_CATEGORIES,
	EXERCISE_MEASURES,
	type ExerciseCategory,
	type ExerciseMeasure,
	exerciseMeasure,
	isLoadedEquipment,
	validateExerciseInput,
} from "@foundry/core";
import type { Exercise } from "@foundry/core/exercises";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { useConvexErrorMessage } from "#/lib/convexError";
import { useMessages } from "#/lib/i18n";

type Draft = {
	name: string;
	muscleGroupsRaw: string;
	category: ExerciseCategory;
	equipment: Equipment;
	measure: ExerciseMeasure;
	notes: string;
	weightIncrement: number | undefined;
};

const FIELD_CLASS =
	"h-9 rounded-md border border-border bg-surface-2 px-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-ink";

function checkDraft({ muscleGroupsRaw, ...draft }: Draft) {
	return validateExerciseInput({
		...draft,
		muscleGroups: muscleGroupsRaw.split(","),
	});
}

function draftOf(exercise: Exercise | undefined): Draft {
	return {
		name: exercise?.name ?? "",
		muscleGroupsRaw: exercise?.muscleGroups.join(", ") ?? "",
		category: exercise?.category ?? "compound",
		equipment: exercise?.equipment ?? "barbell",
		measure: exerciseMeasure(exercise),
		notes: exercise?.notes ?? "",
		weightIncrement: exercise?.weightIncrement,
	};
}

/** Adds a Personal Exercise, or edits `exercise` in place when given. */
export function ExerciseForm({
	exercise,
	onSuccess,
}: {
	exercise?: Exercise;
	onSuccess?: () => void;
} = {}) {
	const t = useMessages().exercise;
	const copy = t.form;
	const createExercise = useMutation(api.exercises.create);
	const updateExercise = useMutation(api.exercises.update);
	const errorMessage = useConvexErrorMessage();
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [savedMeasure] = useState(() => exerciseMeasure(exercise));

	const form = useForm({
		defaultValues: draftOf(exercise),
		validators: {
			onSubmit: ({ value }) => {
				const checked = checkDraft(value);
				if (checked.ok) return undefined;
				return {
					fields: Object.fromEntries(
						checked.errors.map(({ field }) => [field, copy.errors[field]]),
					),
				};
			},
		},
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			const checked = checkDraft(value);
			if (!checked.ok) return;
			try {
				if (exercise)
					await updateExercise({ id: exercise._id, ...checked.value });
				else await createExercise(checked.value);
			} catch (error) {
				setSubmitError(
					errorMessage(error, exercise ? copy.saveFailed : copy.addFailed),
				);
				return;
			}
			if (!exercise) form.reset();
			onSuccess?.();
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				void form.handleSubmit();
			}}
			className="flex flex-col gap-4"
		>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<form.Field name="name">
					{(field) => (
						<div className="flex flex-col gap-1">
							<label
								htmlFor="exercise-name"
								className="text-xs text-text-muted"
							>
								{copy.name}
							</label>
							<input
								id="exercise-name"
								className={FIELD_CLASS}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder={copy.namePlaceholder}
								required
							/>
							<FieldError message={field.state.meta.errors[0]} />
						</div>
					)}
				</form.Field>

				<form.Field name="muscleGroupsRaw">
					{(field) => (
						<div className="flex flex-col gap-1">
							<label
								htmlFor="exercise-muscle-groups"
								className="text-xs text-text-muted"
							>
								{copy.muscleGroups}
							</label>
							<input
								id="exercise-muscle-groups"
								className={FIELD_CLASS}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder={copy.muscleGroupsPlaceholder}
							/>
						</div>
					)}
				</form.Field>

				<form.Field name="category">
					{(field) => (
						<div className="flex flex-col gap-1">
							<label
								htmlFor="exercise-category"
								className="text-xs text-text-muted"
							>
								{copy.category}
							</label>
							<select
								id="exercise-category"
								className={FIELD_CLASS}
								value={field.state.value}
								onChange={(e) =>
									field.handleChange(e.target.value as ExerciseCategory)
								}
							>
								{EXERCISE_CATEGORIES.map((category) => (
									<option key={category} value={category}>
										{t.category[category]}
									</option>
								))}
							</select>
						</div>
					)}
				</form.Field>

				<form.Field name="equipment">
					{(field) => (
						<div className="flex flex-col gap-1">
							<label
								htmlFor="exercise-equipment"
								className="text-xs text-text-muted"
							>
								{copy.equipment}
							</label>
							<select
								id="exercise-equipment"
								className={FIELD_CLASS}
								value={field.state.value}
								onChange={(e) =>
									field.handleChange(e.target.value as Equipment)
								}
							>
								{EQUIPMENT.map((eq) => (
									<option key={eq} value={eq}>
										{t.equipment[eq]}
									</option>
								))}
							</select>
						</div>
					)}
				</form.Field>

				<form.Field name="measure">
					{(field) => (
						<div className="flex flex-col gap-1">
							<label
								htmlFor="exercise-measure"
								className="text-xs text-text-muted"
							>
								{copy.measure}
							</label>
							<select
								id="exercise-measure"
								aria-describedby={
									exercise && field.state.value !== savedMeasure
										? "exercise-measure-help"
										: undefined
								}
								className={FIELD_CLASS}
								value={field.state.value}
								onChange={(e) =>
									field.handleChange(e.target.value as ExerciseMeasure)
								}
							>
								{EXERCISE_MEASURES.map((measure) => (
									<option key={measure} value={measure}>
										{copy.measureNames[measure]}
									</option>
								))}
							</select>
							{exercise && field.state.value !== savedMeasure ? (
								<p
									id="exercise-measure-help"
									className="text-xs text-text-muted"
								>
									{copy.measureChangeHelp}
								</p>
							) : null}
						</div>
					)}
				</form.Field>

				<form.Subscribe selector={(s) => s.values.equipment}>
					{(equipment) =>
						isLoadedEquipment(equipment) ? (
							<form.Field name="weightIncrement">
								{(field) => (
									<div className="flex flex-col gap-1">
										<label
											htmlFor="exercise-weight-increment"
											className="text-xs text-text-muted"
										>
											{copy.weightIncrement}
										</label>
										<input
											id="exercise-weight-increment"
											type="number"
											min="0.25"
											step="0.25"
											className={FIELD_CLASS}
											value={field.state.value ?? ""}
											onChange={(e) =>
												field.handleChange(
													e.target.value
														? parseFloat(e.target.value)
														: undefined,
												)
											}
											placeholder={copy.weightIncrementPlaceholder}
										/>
										<FieldError message={field.state.meta.errors[0]} />
									</div>
								)}
							</form.Field>
						) : null
					}
				</form.Subscribe>

				<form.Field name="notes">
					{(field) => (
						<div className="flex flex-col gap-1 sm:col-span-2">
							<label
								htmlFor="exercise-notes"
								className="text-xs text-text-muted"
							>
								{copy.notes}
							</label>
							<input
								id="exercise-notes"
								className={FIELD_CLASS}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder={copy.notesPlaceholder}
							/>
						</div>
					)}
				</form.Field>
			</div>

			<div className="flex items-center justify-end gap-3">
				{submitError && (
					<p role="alert" className="text-xs text-danger">
						{submitError}
					</p>
				)}
				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(submitting) => (
						<Button
							type="submit"
							loading={submitting}
							className="rounded-full px-5"
						>
							{exercise ? copy.save : copy.add}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}

function FieldError({ message }: { message: string | undefined }) {
	if (!message) return null;
	return <p className="text-xs text-danger">{message}</p>;
}
