import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Clock, Dumbbell } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
	component: DashboardPageGuarded,
});

function DashboardPageGuarded() {
	return (
		<>
			<SignedIn>
				<DashboardPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function DashboardPage() {
	const recentSessions =
		useQuery(api.workoutSessions.listRecent, { limit: 5 }) ?? [];
	const activeSession = useQuery(api.workoutSessions.getActive);
	const exercises = useQuery(api.exercises.list) ?? [];
	const topExercises = exercises.slice(0, 10);

	return (
		<div className="p-4 sm:p-6 max-w-4xl mx-auto">
			<h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

			{activeSession && (
				<div className="mb-6 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)]/20 p-4 flex items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-1.5 mb-0.5">
							<Clock size={14} className="text-[var(--accent)]" />
							<p className="text-sm font-semibold text-[var(--accent)]">
								Active session in progress
							</p>
						</div>
						<p className="text-xs text-[var(--text-muted)] mt-0.5">
							{activeSession.name ??
								`Session ${format(new Date(activeSession.startTime), "MMM d")}`}{" "}
							· started {format(new Date(activeSession.startTime), "h:mm a")}
						</p>
					</div>
					<Link
						to="/log/$sessionId"
						params={{ sessionId: activeSession._id }}
						className="shrink-0 px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-bold hover:bg-[var(--accent-hover)] transition-colors"
					>
						Resume →
					</Link>
				</div>
			)}

			{!activeSession && (
				<div className="mb-8">
					<Link
						to="/log"
						className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--accent)] text-black font-bold text-sm hover:bg-[var(--accent-hover)] transition-colors"
					>
						<Dumbbell size={16} />
						Start Workout
					</Link>
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
					<h2 className="text-sm font-semibold text-white mb-4">
						Recent Sessions
					</h2>
					{recentSessions.length > 0 ? (
						<div className="flex flex-col divide-y divide-[var(--border)]">
							{recentSessions.map((session) => (
								<Link
									key={session._id}
									to="/log/$sessionId"
									params={{ sessionId: session._id }}
									className="py-3 flex items-center justify-between hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
								>
									<div>
										<p className="text-sm font-medium text-white">
											{session.name ??
												`Session ${format(new Date(session.date), "MMM d")}`}
										</p>
										<p className="text-xs text-[var(--text-muted)] mt-0.5">
											{format(new Date(session.date), "EEE, MMM d · h:mm a")}
										</p>
									</div>
									<span
										className={[
											"text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize",
											session.status === "completed"
												? "bg-green-500/10 text-green-400"
												: session.status === "active"
													? "bg-[var(--accent-dim)] text-[var(--accent)]"
													: "bg-white/5 text-[var(--text-muted)]",
										].join(" ")}
									>
										{session.status}
									</span>
								</Link>
							))}
						</div>
					) : (
						<p className="text-sm text-[var(--text-muted)]">
							No sessions yet.{" "}
							<Link to="/log" className="text-[var(--accent)]">
								Log your first workout →
							</Link>
						</p>
					)}
				</div>

				<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
					<h2 className="text-sm font-semibold text-white mb-4">Top 1RMs</h2>
					<div className="flex flex-col divide-y divide-[var(--border)]">
						{topExercises.map((ex) => (
							<ExerciseOrmRow
								key={ex._id}
								exerciseId={ex._id as Id<"exercises">}
								exerciseName={ex.name}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

function ExerciseOrmRow({
	exerciseId,
	exerciseName,
}: {
	exerciseId: Id<"exercises">;
	exerciseName: string;
}) {
	const orm = useQuery(api.oneRepMaxes.getCurrentForExercise, { exerciseId });
	if (!orm) return null;

	return (
		<div className="py-2.5 flex items-center justify-between">
			<Link
				to="/exercises/$id"
				params={{ id: exerciseId }}
				className="text-sm text-white hover:text-[var(--accent)] transition-colors"
			>
				{exerciseName}
			</Link>
			<div className="flex items-center gap-1.5">
				<span className="text-base font-bold text-[var(--accent)]">
					{orm.value}
				</span>
				<span className="text-xs text-[var(--text-muted)]">{orm.unit}</span>
				<span
					className="text-[10px] ml-1 capitalize"
					style={{ color: "var(--text-faint)" }}
				>
					{orm.source === "calculated" ? "est." : orm.source}
				</span>
			</div>
		</div>
	);
}
