import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { format } from "date-fns";
import {
	CheckCircle2,
	Clock,
	Dumbbell,
	LayoutDashboard,
	ListChecks,
	Trash2,
	XCircle,
} from "lucide-react";

interface Props {
	session: Doc<"workoutSessions">;
	sets: Doc<"sets">[];
	exerciseMap: Map<string, Doc<"exercises">>;
}

function formatDuration(ms: number): string {
	const totalMinutes = Math.round(ms / 60000);
	if (totalMinutes < 60) return `${totalMinutes}m`;
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function SessionSummary({ session, sets, exerciseMap }: Props) {
	const navigate = useNavigate();
	const removeSession = useMutation(api.workoutSessions.remove);

	const isCompleted = session.status === "completed";
	const durationMs = session.endTime
		? session.endTime - session.startTime
		: null;

	const workingSets = sets.filter((s) => s.setType === "working");
	const totalVolume = workingSets.reduce(
		(acc, s) => acc + (s.weight ?? 0) * s.reps,
		0,
	);

	const exerciseIds: string[] = [];
	for (const s of sets) {
		if (!exerciseIds.includes(s.exerciseId as string)) {
			exerciseIds.push(s.exerciseId as string);
		}
	}

	const exerciseBreakdown = exerciseIds.map((id) => {
		const exerciseSets = sets.filter((s) => (s.exerciseId as string) === id);
		const bestSet = exerciseSets.reduce(
			(best, s) => ((s.weight ?? 0) > (best.weight ?? 0) ? s : best),
			exerciseSets[0],
		);
		return {
			id,
			name: exerciseMap.get(id)?.name ?? "Unknown",
			sets: exerciseSets,
			bestSet,
		};
	});

	async function handleDelete() {
		if (!confirm("Delete this workout? This cannot be undone.")) return;
		await removeSession({ id: session._id });
		void navigate({ to: "/log" });
	}

	return (
		<div className="p-4 sm:p-6 max-w-3xl mx-auto">
			{/* Header */}
			<div className="mb-6">
				<div className="flex items-center gap-2 mb-2">
					{isCompleted ? (
						<>
							<CheckCircle2 size={16} className="text-[var(--accent)]" />
							<span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
								Workout Complete
							</span>
						</>
					) : (
						<>
							<XCircle size={16} className="text-[var(--text-muted)]" />
							<span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 text-[var(--text-muted)]">
								Workout Cancelled
							</span>
						</>
					)}
				</div>
				<h1 className="text-xl font-bold text-white">
					{session.name ?? "Workout Session"}
				</h1>
				<div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
					<span>
						{format(new Date(session.startTime), "h:mm a · MMM d, yyyy")}
					</span>
					{durationMs !== null && (
						<span className="flex items-center gap-1">
							<Clock size={11} />
							{formatDuration(durationMs)}
						</span>
					)}
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-2 gap-3 mb-6">
				<div className="rounded-xl bg-white/5 p-4">
					<p className="text-xs text-[var(--text-muted)] mb-1">Total Sets</p>
					<p className="text-2xl font-bold text-white">{sets.length}</p>
				</div>
				<div className="rounded-xl bg-white/5 p-4">
					<p className="text-xs text-[var(--text-muted)] mb-1">Volume</p>
					<p className="text-2xl font-bold text-white">
						{totalVolume > 0 ? `${totalVolume.toLocaleString()} kg` : "—"}
					</p>
				</div>
			</div>

			{/* Exercise breakdown */}
			<div className="flex flex-col gap-3 mb-8">
				{exerciseBreakdown.length === 0 ? (
					<div className="rounded-xl bg-white/5 p-4 text-sm text-[var(--text-muted)] flex items-center gap-2">
						<Dumbbell size={14} />
						No sets logged
					</div>
				) : (
					exerciseBreakdown.map((ex) => (
						<div key={ex.id} className="rounded-xl bg-white/5 p-4">
							<div className="flex items-center justify-between mb-2">
								<span className="text-sm font-semibold text-white">
									{ex.name}
								</span>
								<span className="text-xs text-[var(--text-muted)]">
									{ex.sets.length} {ex.sets.length === 1 ? "set" : "sets"}
								</span>
							</div>
							<div className="flex flex-wrap gap-2">
								{ex.sets.map((s, i) => (
									<span
										key={s._id}
										className={`text-xs px-2 py-1 rounded-md ${
											s.setType === "warmup"
												? "bg-yellow-500/10 text-yellow-400"
												: "bg-white/5 text-[var(--text-muted)]"
										}`}
									>
										{i + 1}. {s.weight > 0 ? `${s.weight}kg` : "BW"} × {s.reps}
									</span>
								))}
							</div>
							{ex.bestSet && ex.bestSet.weight > 0 && (
								<p className="text-xs text-[var(--text-muted)] mt-2">
									Best: {ex.bestSet.weight}kg × {ex.bestSet.reps} reps
								</p>
							)}
						</div>
					))
				)}
			</div>

			{/* Actions */}
			<div className="flex flex-col sm:flex-row gap-3">
				<Link
					to="/dashboard"
					className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-bold hover:bg-[var(--accent-hover)] transition-colors"
				>
					<LayoutDashboard size={15} />
					Go to Dashboard
				</Link>
				<Link
					to="/log"
					className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] text-sm hover:text-white hover:border-white/20 transition-colors"
				>
					<ListChecks size={15} />
					Back to Log
				</Link>
				<button
					type="button"
					onClick={() => void handleDelete()}
					className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] text-sm hover:text-red-400 hover:border-red-400/30 transition-colors"
				>
					<Trash2 size={15} />
					Delete
				</button>
			</div>
		</div>
	);
}
