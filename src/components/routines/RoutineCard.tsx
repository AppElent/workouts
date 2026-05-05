import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { Play, Trash2 } from "lucide-react";
import { useState } from "react";

type RoutineExercise = Doc<"routines">["exercises"][number] & { exerciseName: string };
type RoutineWithNames = Omit<Doc<"routines">, "exercises"> & { exercises: RoutineExercise[] };

interface Props {
	routine: RoutineWithNames;
}

export function RoutineCard({ routine }: Props) {
	const navigate = useNavigate();
	const startSession = useMutation(api.routines.startSession);
	const removeRoutine = useMutation(api.routines.remove);
	const [starting, setStarting] = useState(false);

	async function handleStart() {
		if (starting) return;
		setStarting(true);
		try {
			const sessionId = await startSession({ routineId: routine._id });
			void navigate({ to: "/log/$sessionId", params: { sessionId } });
		} finally {
			setStarting(false);
		}
	}

	return (
		<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 flex flex-col gap-3">
			<div className="flex items-start justify-between gap-2">
				<div>
					<h3 className="text-base font-semibold text-white">{routine.name}</h3>
					<p className="text-xs text-[var(--text-muted)] mt-1">
						{routine.exercises.length} exercise
						{routine.exercises.length !== 1 ? "s" : ""}
					</p>
				</div>
				<button
					type="button"
					onClick={() => void removeRoutine({ id: routine._id })}
					className="p-1.5 text-[var(--text-muted)] hover:text-red-400 transition-colors"
					aria-label="Delete routine"
				>
					<Trash2 size={14} />
				</button>
			</div>

			<div className="flex flex-wrap gap-1.5">
				{routine.exercises.slice(0, 4).map((ex) => (
					<span
						key={ex.exerciseId}
						className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]"
					>
						{ex.exerciseName} {ex.defaultSets}×{ex.defaultReps}
					</span>
				))}
				{routine.exercises.length > 4 && (
					<span className="text-[10px] text-[var(--text-muted)]">
						+{routine.exercises.length - 4} more
					</span>
				)}
			</div>

			<button
				type="button"
				onClick={() => void handleStart()}
				disabled={starting}
				className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-bold hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
			>
				<Play size={14} />
				{starting ? "Starting…" : "Start Workout"}
			</button>
		</div>
	);
}
