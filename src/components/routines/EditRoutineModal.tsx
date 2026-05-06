import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Stepper } from "#/components/ui/Stepper";

type RoutineExercise = Doc<"routines">["exercises"][number] & {
	exerciseName: string;
};
export type RoutineWithNames = Omit<Doc<"routines">, "exercises"> & {
	exercises: RoutineExercise[];
};

interface ExerciseEntry {
	exerciseId: Id<"exercises">;
	name: string;
	defaultSets: number;
	defaultReps: number;
	defaultWeight: number | undefined;
}

export interface SavePayload {
	name: string;
	exercises: {
		exerciseId: Id<"exercises">;
		defaultSets: number;
		defaultReps: number;
		defaultWeight: number | undefined;
	}[];
}

interface Props {
	routine: RoutineWithNames;
	open: boolean;
	onClose: () => void;
	onSave: (payload: SavePayload) => void;
}

export function EditRoutineModal({ routine, open, onClose, onSave }: Props) {
	const [name, setName] = useState(routine.name);
	const [entries, setEntries] = useState<ExerciseEntry[]>([]);
	const [search, setSearch] = useState("");
	const [showPicker, setShowPicker] = useState(false);

	const allExercises = useQuery(api.exercises.list);

	useEffect(() => {
		if (open) {
			setName(routine.name);
			setEntries(
				routine.exercises.map((e) => ({
					exerciseId: e.exerciseId,
					name: e.exerciseName,
					defaultSets: e.defaultSets,
					defaultReps: e.defaultReps,
					defaultWeight: e.defaultWeight,
				})),
			);
			setSearch("");
			setShowPicker(false);
		}
	}, [open, routine]);

	if (!open) return null;

	const filtered = (allExercises ?? []).filter((e) =>
		e.name.toLowerCase().includes(search.toLowerCase()),
	);

	function addExercise(ex: { _id: Id<"exercises">; name: string }) {
		setEntries((prev) => [
			...prev,
			{
				exerciseId: ex._id,
				name: ex.name,
				defaultSets: 3,
				defaultReps: 8,
				defaultWeight: undefined,
			},
		]);
		setSearch("");
		setShowPicker(false);
	}

	function removeExercise(index: number) {
		setEntries((prev) => prev.filter((_, i) => i !== index));
	}

	function updateEntry<K extends keyof ExerciseEntry>(
		index: number,
		key: K,
		value: ExerciseEntry[K],
	) {
		setEntries((prev) =>
			prev.map((e, i) => (i === index ? { ...e, [key]: value } : e)),
		);
	}

	function handleSave() {
		onSave({
			name,
			exercises: entries.map(
				({ exerciseId, defaultSets, defaultReps, defaultWeight }) => ({
					exerciseId,
					defaultSets,
					defaultReps,
					defaultWeight,
				}),
			),
		});
	}

	const canSave = name.trim().length > 0 && entries.length > 0;

	return (
		<div
			role="dialog"
			aria-modal="true"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		>
			<div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold text-white">Edit Routine</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Cancel"
						className="text-[var(--text-muted)] hover:text-white"
					>
						<X size={20} />
					</button>
				</div>

				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Routine name"
					className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
				/>

				<div className="space-y-3">
					{entries.map((entry, i) => (
						<div
							key={entry.exerciseId}
							className="bg-[var(--surface-2)] rounded-lg p-3 space-y-2"
						>
							<div className="flex items-center justify-between">
								<span className="text-white font-medium text-sm">
									{entry.name}
								</span>
								<button
									type="button"
									onClick={() => removeExercise(i)}
									aria-label={`Remove ${entry.name}`}
									className="text-[var(--text-muted)] hover:text-red-400"
								>
									<X size={16} />
								</button>
							</div>
							<div className="flex gap-3 flex-col">
								<Stepper
									label="Sets"
									value={entry.defaultSets}
									onChange={(v) => updateEntry(i, "defaultSets", v)}
									min={1}
									max={20}
								/>
								<Stepper
									label="Reps"
									value={entry.defaultReps}
									onChange={(v) => updateEntry(i, "defaultReps", v)}
									min={1}
									max={100}
								/>
								<Stepper
									label="Weight"
									value={entry.defaultWeight ?? 0}
									onChange={(v) =>
										updateEntry(i, "defaultWeight", v === 0 ? undefined : v)
									}
									min={0}
									step={2.5}
									unit="kg"
								/>
							</div>
						</div>
					))}
				</div>

				{showPicker ? (
					<div className="space-y-2">
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search exercises..."
							className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
						/>
						<div className="max-h-40 overflow-y-auto space-y-1">
							{filtered.map((ex) => (
								<button
									key={ex._id}
									type="button"
									onClick={() => addExercise(ex)}
									className="w-full text-left px-3 py-2 rounded-lg text-sm text-white hover:bg-white/10"
								>
									{ex.name}
									{ex.equipment && (
										<span className="ml-2 text-xs text-[var(--text-muted)]">
											{ex.equipment}
										</span>
									)}
								</button>
							))}
						</div>
						<button
							type="button"
							onClick={() => setShowPicker(false)}
							className="text-sm text-[var(--text-muted)] hover:text-white"
						>
							Cancel
						</button>
					</div>
				) : (
					<button
						type="button"
						onClick={() => setShowPicker(true)}
						className="w-full py-2 rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white hover:border-white/40"
					>
						+ Add exercise
					</button>
				)}

				<div className="flex gap-3 pt-2">
					<button
						type="button"
						onClick={onClose}
						className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={!canSave}
						className="flex-1 py-2 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
					>
						Save
					</button>
				</div>
			</div>
		</div>
	);
}
