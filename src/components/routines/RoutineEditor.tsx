import type { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { SET_LIMITS } from "@foundry/core";
import type { FunctionReturnType } from "convex/server";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { ExercisePicker } from "#/components/exercises/ExercisePicker";
import { Stepper } from "#/components/ui/Stepper";
import { useConvexErrorMessage } from "#/lib/convexError";

export type RoutineWithNames = FunctionReturnType<
	typeof api.routines.list
>[number];
export type RoutinePayload = Pick<Doc<"routines">, "name" | "exercises">;

type Entry = Doc<"routines">["exercises"][number] & { name: string };

/** Name and exercise list of a routine, for creating or editing one. */
export function RoutineEditor({
	initial,
	submitLabel,
	onSubmit,
	onCancel,
}: {
	initial?: RoutineWithNames;
	submitLabel: string;
	onSubmit: (payload: RoutinePayload) => Promise<unknown>;
	onCancel?: () => void;
}) {
	const errorMessage = useConvexErrorMessage();
	const [name, setName] = useState(initial?.name ?? "");
	const [entries, setEntries] = useState<Entry[]>(
		() =>
			initial?.exercises.map(({ exerciseName, ...exercise }) => ({
				...exercise,
				name: exerciseName,
			})) ?? [],
	);
	const [picking, setPicking] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function updateEntry(index: number, patch: Partial<Entry>) {
		setEntries((prev) =>
			prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
		);
	}

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (saving) return;
		setSaving(true);
		setError(null);
		try {
			await onSubmit({
				name: name.trim(),
				exercises: entries.map(({ name: _name, ...exercise }) => exercise),
			});
		} catch (err) {
			setError(errorMessage(err, "Failed to save routine."));
		} finally {
			setSaving(false);
		}
	}

	const canSave = name.trim().length > 0 && entries.length > 0 && !saving;

	return (
		<form
			onSubmit={(event) => void handleSubmit(event)}
			className="flex flex-col gap-4"
		>
			<input
				type="text"
				aria-label="Routine name"
				placeholder="Routine name (e.g. Push Day A)"
				value={name}
				onChange={(event) => setName(event.target.value)}
				className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
			/>

			{entries.map((entry, index) => (
				<div
					key={entry.exerciseId}
					className="flex flex-col gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4"
				>
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium text-white">{entry.name}</span>
						<button
							type="button"
							onClick={() =>
								setEntries((prev) => prev.filter((_, i) => i !== index))
							}
							aria-label={`Remove ${entry.name}`}
							className="p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
						>
							<X size={14} />
						</button>
					</div>
					<Stepper
						label="Sets"
						value={entry.defaultSets}
						onChange={(value) => updateEntry(index, { defaultSets: value })}
						min={SET_LIMITS.plannedSets.min}
						max={SET_LIMITS.plannedSets.max}
					/>
					<Stepper
						label="Reps"
						value={entry.defaultReps}
						onChange={(value) => updateEntry(index, { defaultReps: value })}
						min={SET_LIMITS.plannedReps.min}
						max={SET_LIMITS.plannedReps.max}
					/>
					<Stepper
						label="Weight"
						value={entry.defaultWeight ?? 0}
						onChange={(value) =>
							updateEntry(index, {
								defaultWeight: value === 0 ? undefined : value,
							})
						}
						min={SET_LIMITS.plannedWeight.min}
						max={SET_LIMITS.plannedWeight.max}
						step={2.5}
						unit="kg"
					/>
				</div>
			))}

			{picking ? (
				<div className="overflow-hidden rounded-lg border border-[var(--border)]">
					<ExercisePicker
						autoFocus
						onSelect={(exercise) => {
							setEntries((prev) => [
								...prev,
								{
									exerciseId: exercise._id,
									name: exercise.name,
									defaultSets: 3,
									defaultReps: 8,
								},
							]);
							setPicking(false);
						}}
					/>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setPicking(true)}
					className="flex items-center gap-2 text-sm text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
				>
					<Plus size={14} />
					Add Exercise
				</button>
			)}

			{error && <p className="text-sm text-[var(--danger)]">{error}</p>}

			<div className="flex justify-end gap-3">
				{onCancel && (
					<button
						type="button"
						onClick={onCancel}
						className="rounded-full border border-[var(--border)] px-5 py-2 text-sm text-[var(--text-muted)] hover:text-white"
					>
						Cancel
					</button>
				)}
				<button
					type="submit"
					disabled={!canSave}
					className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-40"
				>
					{submitLabel}
				</button>
			</div>
		</form>
	);
}
