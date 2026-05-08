import { api } from "@convex/_generated/api";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { z } from "zod";

const schema = z.object({
	name: z.string().min(1, "Name is required"),
	muscleGroupsRaw: z.string().min(1, "At least one muscle group required"),
	category: z.enum(["compound", "isolation"]),
	equipment: z.enum([
		"barbell",
		"dumbbell",
		"cable",
		"bodyweight",
		"machine",
		"kettlebell",
		"band",
		"other",
	]),
	notes: z.string().optional(),
	weightIncrement: z.number().positive().optional(),
});

type FormValues = z.infer<typeof schema>;

const equipmentOptions = [
	"barbell",
	"dumbbell",
	"cable",
	"bodyweight",
	"machine",
	"kettlebell",
	"band",
	"other",
] as const;

const equipmentWithWeight = new Set([
	"barbell",
	"dumbbell",
	"cable",
	"machine",
	"kettlebell",
	"other",
]);

export function AddExerciseForm({ onSuccess }: { onSuccess?: () => void } = {}) {
	const createExercise = useMutation(api.exercises.create);

	const form = useForm({
		defaultValues: {
			name: "",
			muscleGroupsRaw: "",
			category: "compound" as "compound" | "isolation",
			equipment: "barbell" as FormValues["equipment"],
			notes: "",
			weightIncrement: undefined as number | undefined,
		},
		onSubmit: async ({ value }) => {
			const parsed = schema.parse(value);
			const muscleGroups = parsed.muscleGroupsRaw
				.split(",")
				.map((s) => s.trim().toLowerCase())
				.filter(Boolean);
			await createExercise({
				name: parsed.name,
				muscleGroups,
				category: parsed.category,
				equipment: parsed.equipment,
				notes: parsed.notes || undefined,
				weightIncrement: parsed.weightIncrement,
			});
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
							{field.state.meta.errors.length > 0 && (
								<p className="text-xs text-red-400">
									{String(field.state.meta.errors[0])}
								</p>
							)}
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
								required
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
									field.handleChange(e.target.value as "compound" | "isolation")
								}
							>
								<option value="compound">Compound</option>
								<option value="isolation">Isolation</option>
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
									field.handleChange(e.target.value as FormValues["equipment"])
								}
							>
								{equipmentOptions.map((eq) => (
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
						equipmentWithWeight.has(equipment) ? (
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

			<div className="flex justify-end">
				<button
					type="submit"
					className="px-5 py-2 rounded-full bg-[var(--accent)] text-black text-sm font-bold hover:bg-[var(--accent-hover)] transition-colors"
				>
					Add Exercise
				</button>
			</div>
		</form>
	);
}
