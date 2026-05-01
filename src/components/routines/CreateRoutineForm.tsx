import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Stepper } from "#/components/ui/Stepper";

interface ExerciseEntry {
	exerciseId: Id<"exercises">;
	name: string;
	defaultSets: number;
	defaultReps: number;
	defaultWeight: number | undefined;
}

export function CreateRoutineForm() {
	const createRoutine = useMutation(api.routines.create);
	const exercises = useQuery(api.exercises.list) ?? [];

	const [name, setName] = useState("");
	const [entries, setEntries] = useState<ExerciseEntry[]>([]);
	const [search, setSearch] = useState("");
	const [showPicker, setShowPicker] = useState(false);

	const filteredExercises = exercises.filter((ex) =>
		ex.name.toLowerCase().includes(search.toLowerCase()),
	);

	function addExercise(exId: Id<"exercises">, exName: string) {
		setEntries((prev) => [
			...prev,
			{
				exerciseId: exId,
				name: exName,
				defaultSets: 3,
				defaultReps: 8,
				defaultWeight: undefined,
			},
		]);
		setShowPicker(false);
		setSearch("");
	}

	function removeEntry(index: number) {
		setEntries((prev) => prev.filter((_, i) => i !== index));
	}

	function updateEntry(index: number, patch: Partial<ExerciseEntry>) {
		setEntries((prev) =>
			prev.map((e, i) => (i === index ? { ...e, ...patch } : e)),
		);
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim() || entries.length === 0) return;
		await createRoutine({
			name: name.trim(),
			exercises: entries.map(
				({ exerciseId, defaultSets, defaultReps, defaultWeight }) => ({
					exerciseId,
					defaultSets,
					defaultReps,
					defaultWeight,
				}),
			),
		});
		setName("");
		setEntries([]);
	}

	return (
		<form
			onSubmit={(e) => void handleSubmit(e)}
			className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 flex flex-col gap-4"
		>
			<h2 className="text-sm font-semibold text-white">Create Routine</h2>

			<input
				type="text"
				placeholder="Routine name (e.g. Push Day A)"
				value={name}
				onChange={(e) => setName(e.target.value)}
				className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
				required
			/>

			{entries.length > 0 && (
				<div className="flex flex-col gap-3">
					{entries.map((entry, i) => (
						<div
							key={entry.exerciseId}
							className="flex flex-col gap-2.5 p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]"
						>
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium text-white">
									{entry.name}
								</span>
								<button
									type="button"
									onClick={() => removeEntry(i)}
									className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors"
								>
									<X size={14} />
								</button>
							</div>
							<Stepper
								value={entry.defaultSets}
								onChange={(v) => updateEntry(i, { defaultSets: v })}
								min={1}
								max={20}
								step={1}
								label="Sets"
							/>
							<Stepper
								value={entry.defaultReps}
								onChange={(v) => updateEntry(i, { defaultReps: v })}
								min={1}
								max={100}
								step={1}
								label="Reps"
							/>
							<Stepper
								value={entry.defaultWeight ?? 0}
								onChange={(v) =>
									updateEntry(i, { defaultWeight: v === 0 ? undefined : v })
								}
								min={0}
								step={2.5}
								unit="kg"
								label="Weight"
							/>
						</div>
					))}
				</div>
			)}

			{showPicker ? (
				<div className="rounded-lg border border-[var(--border)] overflow-hidden">
					<input
						type="search"
						placeholder="Search exercises…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full h-9 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none"
					/>
					<div className="max-h-48 overflow-y-auto divide-y divide-[var(--border)]">
						{filteredExercises.map((ex) => (
							<button
								key={ex._id}
								type="button"
								onClick={() => addExercise(ex._id, ex.name)}
								className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors"
							>
								{ex.name}
								<span className="text-xs text-[var(--text-muted)] ml-2 capitalize">
									{ex.equipment}
								</span>
							</button>
						))}
					</div>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setShowPicker(true)}
					className="flex items-center gap-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
				>
					<Plus size={14} />
					Add Exercise
				</button>
			)}

			<div className="flex justify-end">
				<button
					type="submit"
					disabled={!name.trim() || entries.length === 0}
					className="px-5 py-2 rounded-full bg-[var(--accent)] text-black text-sm font-bold disabled:opacity-40 hover:bg-[var(--accent-hover)] transition-colors"
				>
					Save Routine
				</button>
			</div>
		</form>
	);
}
