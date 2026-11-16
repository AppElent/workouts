import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import {
	formatDurationMinutes,
	formatScore,
	toKg,
	workingVolume,
} from "@foundry/core";
import type { Exercise } from "@foundry/core/exercises";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
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
import { useConfirm } from "#/components/ui/confirm-dialog";
import { useToast } from "#/components/ui/toast";
import { useConvexErrorMessage } from "#/lib/convexError";

interface Props {
	session: Doc<"workoutSessions">;
	sets: Doc<"sets">[];
	exerciseMap: Map<string, Exercise>;
}

export function SessionSummary({ session, sets, exerciseMap }: Props) {
	const navigate = useNavigate();
	const removeSession = useMutation(api.workoutSessions.remove);
	const confirm = useConfirm();
	const toast = useToast();
	const errorMessage = useConvexErrorMessage();
	const wodResults =
		useQuery(api.wodResults.listForSession, { sessionId: session._id }) ?? [];
	const wods = useQuery(api.wods.list) ?? [];
	const wodMap = new Map(wods.map((w) => [w._id as string, w]));

	const isCompleted = session.status === "completed";
	const durationMs = session.endTime
		? session.endTime - session.startTime
		: null;

	const totalVolume = Math.round(workingVolume(sets));

	const exerciseIds: string[] = [];
	for (const s of sets) {
		if (!exerciseIds.includes(s.exerciseId as string)) {
			exerciseIds.push(s.exerciseId as string);
		}
	}

	const exerciseBreakdown = exerciseIds.map((id) => {
		const exerciseSets = sets.filter((s) => (s.exerciseId as string) === id);
		const bestSet = exerciseSets.reduce(
			(best, s) =>
				toKg(s.weight, s.unit) > toKg(best.weight, best.unit) ? s : best,
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
		const ok = await confirm({
			title: "Delete this workout?",
			description: "This cannot be undone.",
			confirmLabel: "Delete workout",
			destructive: true,
		});
		if (!ok) return;
		try {
			await removeSession({ id: session._id });
		} catch (err) {
			toast.error(
				"Couldn't delete workout",
				errorMessage(err, "Please try again."),
			);
			return;
		}
		void navigate({ to: "/log" });
	}

	return (
		<div className="p-4 sm:p-6 max-w-3xl mx-auto">
			<div className="mb-6">
				<div className="flex items-center gap-2 mb-2">
					{isCompleted ? (
						<>
							<CheckCircle2 size={16} className="text-accent-ink" />
							<span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-dim text-accent-ink">
								Workout Complete
							</span>
						</>
					) : (
						<>
							<XCircle size={16} className="text-text-muted" />
							<span className="text-xs font-medium px-2 py-0.5 rounded-full bg-text/5 text-text-muted">
								Workout Cancelled
							</span>
						</>
					)}
				</div>
				<h1 className="text-xl font-bold text-text">
					{session.name ?? "Workout Session"}
				</h1>
				<div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
					<span>
						{format(new Date(session.startTime), "h:mm a · MMM d, yyyy")}
					</span>
					{durationMs !== null && (
						<span className="flex items-center gap-1">
							<Clock size={11} />
							{formatDurationMinutes(durationMs)}
						</span>
					)}
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3 mb-6">
				<div className="rounded-xl bg-text/5 p-4">
					<p className="text-xs text-text-muted mb-1">Total Sets</p>
					<p className="text-2xl font-bold text-text">{sets.length}</p>
				</div>
				<div className="rounded-xl bg-text/5 p-4">
					<p className="text-xs text-text-muted mb-1">Volume</p>
					<p className="text-2xl font-bold text-text">
						{totalVolume > 0 ? `${totalVolume.toLocaleString()} kg` : "—"}
					</p>
				</div>
			</div>

			<div className="flex flex-col gap-3 mb-8">
				{exerciseBreakdown.length === 0 ? (
					<div className="rounded-xl bg-text/5 p-4 text-sm text-text-muted flex items-center gap-2">
						<Dumbbell size={14} />
						No sets logged
					</div>
				) : (
					exerciseBreakdown.map((ex) => (
						<div key={ex.id} className="rounded-xl bg-text/5 p-4">
							<div className="flex items-center justify-between mb-2">
								<span className="text-sm font-semibold text-text">
									{ex.name}
								</span>
								<span className="text-xs text-text-muted">
									{ex.sets.length} {ex.sets.length === 1 ? "set" : "sets"}
								</span>
							</div>
							<div className="flex flex-wrap gap-2">
								{ex.sets.map((s, i) => (
									<span
										key={s._id}
										className={`text-xs px-2 py-1 rounded-md ${
											s.setType === "warmup"
												? "bg-warn-soft text-warn"
												: "bg-text/5 text-text-muted"
										}`}
									>
										{i + 1}. {s.weight > 0 ? `${s.weight}kg` : "BW"} × {s.reps}
									</span>
								))}
							</div>
							{ex.bestSet && ex.bestSet.weight > 0 && (
								<p className="text-xs text-text-muted mt-2">
									Best: {ex.bestSet.weight}
									{ex.bestSet.unit} × {ex.bestSet.reps} reps
								</p>
							)}
						</div>
					))
				)}
			</div>

			{wodResults.length > 0 && (
				<div className="mt-4 flex flex-col gap-2">
					<h3 className="text-sm font-semibold text-text">WODs</h3>
					{wodResults.map((r) => {
						const wod = wodMap.get(r.wodId as string);
						if (!wod) return null;
						return (
							<div
								key={r._id}
								className="flex items-center justify-between rounded-lg bg-surface-2 border border-border px-4 py-2.5"
							>
								<span className="text-sm text-text">{wod.name}</span>
								<span className="text-sm text-accent-ink tabular-nums">
									{formatScore(wod.type, r)}{" "}
									<span className="text-micro uppercase text-text-muted">
										{r.rxScaled}
									</span>
								</span>
							</div>
						);
					})}
				</div>
			)}

			<div className="flex flex-col sm:flex-row gap-3">
				<Link
					to="/dashboard"
					className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent-fill text-on-accent text-sm font-bold hover:bg-accent-pressed transition-colors"
				>
					<LayoutDashboard size={15} />
					Go to Dashboard
				</Link>
				<Link
					to="/log"
					className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-text-muted text-sm hover:text-text hover:border-border-strong transition-colors"
				>
					<ListChecks size={15} />
					Back to Log
				</Link>
				<button
					type="button"
					onClick={() => void handleDelete()}
					className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-text-muted text-sm hover:text-danger hover:border-danger/30 transition-colors"
				>
					<Trash2 size={15} />
					Delete
				</button>
			</div>
		</div>
	);
}
