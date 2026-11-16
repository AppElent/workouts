import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Dumbbell, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useStartRoutine } from "#/components/routines/useStartRoutine";
import { useConvexErrorMessage } from "#/lib/convexError";

export const Route = createFileRoute("/_app/_authed/log/")({
	component: LogPage,
});

function LogPage() {
	const navigate = useNavigate();
	const activeSession = useQuery(api.workoutSessions.getActive);
	const routines = useQuery(api.routines.list) ?? [];
	const createSession = useMutation(api.workoutSessions.create);
	const errorMessage = useConvexErrorMessage();

	const [sessionName, setSessionName] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (activeSession) {
			void navigate({
				to: "/log/$sessionId",
				params: { sessionId: activeSession._id },
				replace: true,
			});
		}
	}, [activeSession, navigate]);

	async function handleStartFreeForm(e: React.FormEvent) {
		e.preventDefault();
		if (creating) return;
		setCreating(true);
		setError("");
		try {
			const sessionId = await createSession({
				name: sessionName.trim() || undefined,
			});
			void navigate({ to: "/log/$sessionId", params: { sessionId } });
		} catch (err) {
			setError(errorMessage(err, "Failed to start session"));
			setCreating(false);
		}
	}

	return (
		<div className="p-4 sm:p-6 max-w-2xl mx-auto">
			<h1 className="text-2xl font-bold text-text mb-6">Log Workout</h1>

			<form
				onSubmit={(e) => void handleStartFreeForm(e)}
				className="rounded-xl bg-surface border border-border p-5 mb-6"
			>
				<h2 className="text-sm font-semibold text-text mb-4">
					Start New Session
				</h2>
				<div className="flex gap-2">
					<input
						type="text"
						placeholder="Session name (optional)"
						value={sessionName}
						onChange={(e) => setSessionName(e.target.value)}
						className="flex-1 h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-ink"
					/>
					<button
						type="submit"
						disabled={creating}
						className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent-fill text-on-accent text-sm font-bold disabled:opacity-50 hover:bg-accent-pressed transition-colors"
					>
						<Dumbbell size={15} />
						{creating ? "Starting…" : "Start"}
					</button>
				</div>
				{error && <p className="mt-2 text-xs text-danger">{error}</p>}
			</form>

			{routines.length > 0 && (
				<div className="rounded-xl bg-surface border border-border p-5">
					<h2 className="text-sm font-semibold text-text mb-4">
						Start from Routine
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{routines.map((routine) => (
							<StartFromRoutineButton key={routine._id} routine={routine} />
						))}
					</div>
				</div>
			)}

			{routines.length === 0 && (
				<div className="rounded-xl bg-surface border border-border p-5 text-center">
					<p className="text-text-muted text-sm mb-3">No routines yet.</p>
					<Link
						to="/routines"
						className="text-sm text-accent-ink hover:underline"
					>
						Create a routine →
					</Link>
				</div>
			)}
		</div>
	);
}

function StartFromRoutineButton({ routine }: { routine: Doc<"routines"> }) {
	const { start, starting } = useStartRoutine();

	return (
		<button
			type="button"
			onClick={() => void start(routine._id)}
			disabled={starting}
			className="flex items-center justify-between gap-2 p-4 rounded-lg border border-border bg-surface-2 hover:border-accent-ink/30 transition-colors text-left disabled:opacity-50"
		>
			<div>
				<p className="text-sm font-medium text-text">{routine.name}</p>
				<p className="text-xs text-text-muted mt-0.5">
					{routine.exercises.length} exercises
				</p>
			</div>
			<Play size={16} className="text-accent-ink shrink-0" />
		</button>
	);
}
