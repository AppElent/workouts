import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { CheckCircle, Plus, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HostedScoreForm } from "#/components/hosted/HostedScoreForm";
import { AddExerciseModal } from "#/components/session/AddExerciseModal";
import { ExerciseSection } from "#/components/session/ExerciseSection";
import { RestTimerProvider } from "#/components/session/RestTimer";
import { SessionSummary } from "#/components/session/SessionSummary";
import { SessionWods } from "#/components/session/SessionWods";
import { SetEditSheet } from "#/components/session/SetEditSheet";
import type { HostedWodType } from "#/lib/hostedWorkouts";

export const Route = createFileRoute("/log/$sessionId")({
	component: ActiveSessionPageGuarded,
});

function ActiveSessionPageGuarded() {
	return (
		<>
			<SignedIn>
				<ActiveSessionPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function ActiveSessionPage() {
	const { sessionId } = Route.useParams();

	const session = useQuery(api.workoutSessions.getById, {
		id: sessionId as Id<"workoutSessions">,
	});
	const sets =
		useQuery(api.sets.listForSession, {
			sessionId: sessionId as Id<"workoutSessions">,
		}) ?? [];
	const hostedParticipant = useQuery(
		api.hostedWorkoutParticipants.getBySession,
		{
			sessionId: sessionId as Id<"workoutSessions">,
		},
	);

	const finishSession = useMutation(api.workoutSessions.finish);
	const cancelSession = useMutation(api.workoutSessions.cancel);
	const submitHostedScore = useMutation(
		api.hostedWorkoutSubmissions.submitForSession,
	);

	const [showAddExercise, setShowAddExercise] = useState(false);
	const [exerciseOrder, setExerciseOrder] = useState<Id<"exercises">[]>([]);
	const [editing, setEditing] = useState<{
		setId: Id<"sets">;
		exerciseName: string;
		weightStep: number;
	} | null>(null);

	const editingSet = useMemo(() => {
		if (!editing) return null;
		return sets.find((s) => s._id === editing.setId) ?? null;
	}, [editing, sets]);

	useEffect(() => {
		if (editing && !editingSet) setEditing(null);
	}, [editing, editingSet]);

	const bottomRef = useRef<HTMLDivElement>(null);
	const prevCountRef = useRef<number | null>(null);

	const exerciseIds: Id<"exercises">[] = [];
	for (const set of sets) {
		if (!exerciseIds.includes(set.exerciseId)) {
			exerciseIds.push(set.exerciseId);
		}
	}
	if (hostedParticipant) {
		for (const block of hostedParticipant.hosted.template.strengthBlocks) {
			if (block.exerciseId && !exerciseIds.includes(block.exerciseId)) {
				exerciseIds.push(block.exerciseId);
			}
		}
	}
	for (const id of exerciseOrder) {
		if (!exerciseIds.includes(id)) exerciseIds.push(id);
	}

	useEffect(() => {
		if (
			prevCountRef.current !== null &&
			exerciseIds.length > prevCountRef.current
		) {
			bottomRef.current?.scrollIntoView({ behavior: "smooth" });
		}
		prevCountRef.current = exerciseIds.length;
	}, [exerciseIds.length]);

	const exercises = useQuery(api.exercises.list) ?? [];
	const exerciseMap = new Map(exercises.map((ex) => [ex._id as string, ex]));

	function handleExerciseSelect(exerciseId: Id<"exercises">) {
		setExerciseOrder((prev) => [...prev, exerciseId]);
		setShowAddExercise(false);
	}

	async function handleFinish() {
		await finishSession({ id: sessionId as Id<"workoutSessions"> });
	}

	async function handleCancel() {
		if (!confirm("Cancel this workout? All logged sets will be kept.")) return;
		await cancelSession({ id: sessionId as Id<"workoutSessions"> });
	}

	if (session === undefined) {
		return <div className="p-6 text-[var(--text-muted)] text-sm">Loading…</div>;
	}
	if (session === null) {
		return <div className="p-6 text-red-400 text-sm">Session not found.</div>;
	}

	if (session.status !== "active") {
		return (
			<SessionSummary session={session} sets={sets} exerciseMap={exerciseMap} />
		);
	}

	return (
		<RestTimerProvider>
			<div className="p-4 sm:p-6 max-w-3xl mx-auto">
				<div className="mb-6">
					<h1 className="text-xl font-bold text-white">
						{session.name ??
							`Session ${format(new Date(session.startTime), "MMM d")}`}
					</h1>
					<p className="text-xs text-[var(--text-muted)] mt-1">
						Started {format(new Date(session.startTime), "h:mm a · MMM d")}
					</p>
					<div className="flex items-center gap-2 mt-4">
						<button
							type="button"
							onClick={() => void handleFinish()}
							className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-bold hover:bg-[var(--accent-hover)] transition-colors"
						>
							<CheckCircle size={15} />
							Finish Workout
						</button>
						<button
							type="button"
							onClick={() => void handleCancel()}
							className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] text-sm hover:text-red-400 hover:border-red-400/30 transition-colors"
						>
							<XCircle size={15} />
							Cancel
						</button>
					</div>
				</div>

				<div className="flex flex-col gap-4 mb-6">
					{exerciseIds.map((exerciseId) => {
						const exercise = exerciseMap.get(exerciseId as string);
						if (!exercise) return null;
						const exerciseSets = sets.filter(
							(s) => s.exerciseId === exerciseId,
						);
						return (
							<ExerciseSection
								key={exerciseId}
								exerciseId={exerciseId}
								exerciseName={exercise.name}
								equipment={exercise.equipment}
								weightIncrement={exercise.weightIncrement}
								sessionId={sessionId as Id<"workoutSessions">}
								sets={exerciseSets}
								onEditSet={(s, name, step) =>
									setEditing({
										setId: s._id,
										exerciseName: name,
										weightStep: step,
									})
								}
							/>
						);
					})}
					{hostedParticipant?.hosted.template.strengthBlocks
						.filter((block) => !block.exerciseId)
						.map((block) => (
							<div
								key={block.blockId}
								className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
							>
								<h3 className="text-base font-semibold text-white">
									{block.exerciseName}
								</h3>
								{block.instructions && (
									<p className="mt-2 text-sm text-[var(--text-muted)]">
										{block.instructions}
									</p>
								)}
							</div>
						))}
				</div>

				<div ref={bottomRef} />

				<button
					type="button"
					onClick={() => setShowAddExercise(true)}
					className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-muted)] text-sm hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors"
				>
					<Plus size={16} />
					Add Exercise
				</button>

				{showAddExercise && (
					<AddExerciseModal
						onSelect={handleExerciseSelect}
						onClose={() => setShowAddExercise(false)}
					/>
				)}

				{hostedParticipant ? (
					<div className="mt-4">
						<HostedScoreForm
							wodBlocks={hostedParticipant.hosted.template.wodBlocks.map(
								(block) => ({
									blockId: block.blockId,
									name: block.name,
									type: block.type as HostedWodType,
									levels: block.levels.map((level) => ({
										level: level.level,
										label: level.label,
									})),
								}),
							)}
							submitLabel="Submit hosted score"
							onSubmit={(payload) =>
								submitHostedScore({
									sessionId: sessionId as Id<"workoutSessions">,
									...payload,
								})
							}
						/>
					</div>
				) : (
					<SessionWods sessionId={sessionId as Id<"workoutSessions">} />
				)}

				<SetEditSheet
					set={editingSet}
					exerciseName={editing?.exerciseName ?? ""}
					weightStep={editing?.weightStep ?? 2.5}
					onClose={() => setEditing(null)}
				/>
			</div>
		</RestTimerProvider>
	);
}
