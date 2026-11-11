import { api } from "@convex/_generated/api";
import {
	EQUIPMENT,
	type Equipment,
	EXERCISE_CATEGORIES,
	type ExerciseCategory,
	isLoadedEquipment,
	validateExerciseInput,
} from "@foundry/core";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { useState } from "react";
import { useConvexErrorMessage } from "#/lib/convexError";

const FIELD_ERRORS = {
	name: "Name is required",
	weightIncrement: "Weight increment must be more than 0",
};

type Draft = {
	name: string;
	muscleGroupsRaw: string;
	category: ExerciseCategory;
	equipment: Equipment;
	notes: string;
	weightIncrement: number | undefined;
};

function checkDraft({ muscleGroupsRaw, ...draft }: Draft) {
	return validateExerciseInput({
		...draft,
		muscleGroups: muscleGroupsRaw.split(","),
	});
}

export function AddExerciseForm({
	onSuccess,
}: {
	onSuccess?: () => void;
} = {}) {
	const createExercise = useMutation(api.exercises.create);
	const errorMessage = useConvexErrorMessage();
	const [submitError, setSubmitError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			name: "",
			muscleGroupsRaw: "",
			category: "compound",
			equipment: "barbell",
			notes: "",
			weightIncrement: undefined,
		} as Draft,
		validators: {
			onSubmit: ({ value }) => {
				const checked = checkDraft(value);
				if (checked.ok) return undefined;
				return {
					fields: Object.fromEntries(
						checked.errors.map(({ field }) => [field, FIELD_ERRORS[field]]),
					),
				};
			},
		},
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			const checked = checkDraft(value);
			if (!checked.ok) return;
			try {
				await createExercise(checked.value);
			} catch (error) {
				setSubmitError(errorMessage(error, "Couldn't add exercise."));
				return;
			}
			form.reset();
			onSuccess?.();
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				void form.handleSubmit();
			}}
			className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 flex flex-col gap-4"
		>
			<h2 className="text-sm font-semibold text-white">Add Custom Exercise</h2>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<form.Field name="name">
					{(field) => (
						<div className="flex flex-col gap-1">
							<label
								htmlFor="exercise-name"
								className="text-xs text-[var(--text-muted)]"
							>
								Name
							</label>
							<input
								id="exercise-name"
								className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="e.g. Cable Lateral Raise"
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
								className="text-xs text-[var(--text-muted)]"
							>
								Muscle Groups (comma-separated)
							</label>
							<input
								id="exercise-muscle-groups"
								className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="e.g. side delts, traps"
							/>
						</div>
					)}
				</form.Field>

				<form.Field name="category">
					{(field) => (
						<div className="flex flex-col gap-1">
							<label
								htmlFor="exercise-category"
								className="text-xs text-[var(--text-muted)]"
							>
								Category
							</label>
							<select
								id="exercise-category"
								className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
								value={field.state.value}
								onChange={(e) =>
									field.handleChange(e.target.value as ExerciseCategory)
								}
							>
								{EXERCISE_CATEGORIES.map((category) => (
									<option key={category} value={category}>
										{category.charAt(0).toUpperCase() + category.slice(1)}
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
								className="text-xs text-[var(--text-muted)]"
							>
								Equipment
							</label>
							<select
								id="exercise-equipment"
								className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
								value={field.state.value}
								onChange={(e) =>
									field.handleChange(e.target.value as Equipment)
								}
							>
								{EQUIPMENT.map((eq) => (
									<option key={eq} value={eq} className="capitalize">
										{eq.charAt(0).toUpperCase() + eq.slice(1)}
									</option>
								))}
							</select>
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
											className="text-xs text-[var(--text-muted)]"
										>
											Weight increment kg (optional)
										</label>
										<input
											id="exercise-weight-increment"
											type="number"
											min="0.25"
											step="0.25"
											className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
											value={field.state.value ?? ""}
											onChange={(e) =>
												field.handleChange(
													e.target.value
														? parseFloat(e.target.value)
														: undefined,
												)
											}
											placeholder="e.g. 2.5"
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
								className="text-xs text-[var(--text-muted)]"
							>
								Notes (optional)
							</label>
							<input
								id="exercise-notes"
								className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Form cues, tips..."
							/>
						</div>
					)}
				</form.Field>
			</div>

			<div className="flex items-center justify-end gap-3">
				{submitError && (
					<p role="alert" className="text-xs text-[var(--danger)]">
						{submitError}
					</p>
				)}
				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(submitting) => (
						<button
							type="submit"
							disabled={submitting}
							className="px-5 py-2 rounded-full bg-[var(--accent)] text-black text-sm font-bold hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
						>
							Add Exercise
						</button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}

function FieldError({ message }: { message: string | undefined }) {
	if (!message) return null;
	return <p className="text-xs text-[var(--danger)]">{message}</p>;
}
