import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { ArrowLeft, Dumbbell, Lock, Pencil, Play, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { HostedLeaderboard } from "#/components/hosted/HostedLeaderboard";
import { HostedWodLevels } from "#/components/hosted/HostedWodLevels";
import { HostedWorkoutQr } from "#/components/hosted/HostedWorkoutQr";
import { useConfirm } from "#/components/ui/confirm-dialog";
import { useToast } from "#/components/ui/toast";
import { getConvexErrorMessage } from "#/lib/convexError";
import {
	formatWodTiming,
	type HostedLeaderboardRow,
	type HostedWodType,
} from "#/lib/hostedWorkouts";

export function HostedWorkoutDashboard({ id }: { id: Id<"hostedWorkouts"> }) {
	const data = useQuery(api.hostedWorkouts.getMine, { id });
	const myParticipant = useQuery(
		api.hostedWorkoutParticipants.getMyParticipant,
		{ hostedWorkoutId: id },
	);
	const openHostedWorkout = useMutation(api.hostedWorkouts.open);
	const closeHostedWorkout = useMutation(api.hostedWorkouts.close);
	const removeHostedWorkout = useMutation(api.hostedWorkouts.remove);
	const removeSubmission = useMutation(api.hostedWorkoutSubmissions.remove);
	const navigate = useNavigate();
	const confirm = useConfirm();
	const toast = useToast();

	const joinUrl = useMemo(() => {
		if (!data?.hosted.joinToken) return "";
		if (typeof window === "undefined") return `/join/${data.hosted.joinToken}`;
		return `${window.location.origin}/join/${data.hosted.joinToken}`;
	}, [data?.hosted.joinToken]);

	if (data === undefined) {
		return (
			<div className="p-6 text-sm text-[var(--text-muted)]">Loading...</div>
		);
	}

	if (data === null) {
		return (
			<div className="p-6 text-sm text-red-400">Hosted workout not found.</div>
		);
	}

	const { hosted, participants, submissions } = data;
	const participantById = new Map(participants.map((p) => [p._id, p]));

	async function runAction(action: () => Promise<unknown>) {
		try {
			await action();
		} catch (err) {
			toast.error(
				"Action failed",
				getConvexErrorMessage(err, "Something went wrong."),
			);
		}
	}

	async function handleDelete() {
		const ok = await confirm({
			title: "Delete this hosted workout?",
			description: "Its scores and participants will be removed.",
			confirmLabel: "Delete hosted workout",
			destructive: true,
		});
		if (!ok) return;
		void runAction(async () => {
			await removeHostedWorkout({ id });
			await navigate({ to: "/hosted-workouts" });
		});
	}

	return (
		<div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
			<div>
				<Link
					to="/hosted-workouts"
					className="mb-3 inline-flex items-center gap-1 text-xs text-[var(--text-muted)] transition-colors hover:text-white"
				>
					<ArrowLeft size={13} />
					Hosted Workouts
				</Link>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="text-2xl font-bold text-white">{hosted.title}</h1>
							<span className="rounded-full border border-[var(--border)] px-2 py-1 text-xs uppercase text-[var(--text-muted)]">
								{hosted.status}
							</span>
						</div>
						{hosted.scheduledAt && (
							<p className="mt-1 text-sm text-[var(--text-muted)]">
								{format(new Date(hosted.scheduledAt), "MMM d, yyyy h:mm a")}
							</p>
						)}
						{hosted.notes && (
							<p className="mt-3 max-w-2xl text-sm text-[var(--text-muted)]">
								{hosted.notes}
							</p>
						)}
					</div>
					<div className="flex flex-wrap gap-2">
						{hosted.status === "draft" && (
							<>
								<Link
									to="/hosted-workouts/edit/$id"
									params={{ id }}
									className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-white"
								>
									<Pencil size={15} /> Edit
								</Link>
								<button
									type="button"
									onClick={() => runAction(() => openHostedWorkout({ id }))}
									className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-black"
								>
									<Play size={15} /> Open
								</button>
							</>
						)}
						{hosted.status === "open" && myParticipant && (
							<Link
								to="/log/$sessionId"
								params={{ sessionId: myParticipant.sessionId }}
								className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-black"
							>
								<Dumbbell size={15} /> Go to my session
							</Link>
						)}
						{hosted.status === "open" && (
							<button
								type="button"
								onClick={() => runAction(() => closeHostedWorkout({ id }))}
								className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-white"
							>
								<Lock size={15} /> Close
							</button>
						)}
						<button
							type="button"
							onClick={handleDelete}
							className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-red-400 hover:border-red-400/40"
						>
							<Trash2 size={15} /> Delete
						</button>
					</div>
				</div>
			</div>

			<div className="grid gap-4 lg:grid-cols-[280px_1fr]">
				{hosted.status === "draft" ? (
					<div className="flex h-fit flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
						<p className="font-semibold text-white">Join link</p>
						<p>
							The QR code and join link become active once you open this
							workout.
						</p>
					</div>
				) : (
					<HostedWorkoutQr url={joinUrl} />
				)}

				<section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
					<h2 className="text-sm font-semibold text-white">Participants</h2>
					<div className="mt-3 grid gap-2 sm:grid-cols-2">
						{participants.length === 0 && (
							<p className="text-sm text-[var(--text-muted)]">
								No signed-in athletes have joined yet.
							</p>
						)}
						{participants.map((participant) => (
							<div
								key={participant._id}
								className="rounded-lg border border-[var(--border)] px-3 py-2"
							>
								<p className="text-sm font-medium text-white">
									{participant.displayName || "Signed-in athlete"}
								</p>
								<p className="mt-1 text-xs text-[var(--text-muted)]">
									Joined {format(new Date(participant.joinedAt), "h:mm a")}
								</p>
							</div>
						))}
					</div>
				</section>
			</div>

			<div className="grid gap-4">
				{hosted.template.strengthBlocks.length > 0 && (
					<section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
						<h2 className="text-sm font-semibold text-white">Strength</h2>
						<div className="mt-3 grid gap-3 sm:grid-cols-2">
							{hosted.template.strengthBlocks.map((block) => (
								<div
									key={block.blockId}
									className="rounded-lg border border-[var(--border)] px-3 py-2"
								>
									<p className="font-medium text-white">{block.exerciseName}</p>
									{block.instructions && (
										<p className="mt-1 text-sm text-[var(--text-muted)]">
											{block.instructions}
										</p>
									)}
								</div>
							))}
						</div>
					</section>
				)}

				{hosted.template.wodBlocks.map((block) => {
					const rows: HostedLeaderboardRow[] = submissions
						.filter((submission) => submission.wodBlockId === block.blockId)
						.map((submission) => ({
							id: submission._id,
							name:
								submission.guestName ||
								(submission.participantId
									? participantById.get(submission.participantId)?.displayName
									: undefined) ||
								"Signed-in athlete",
							level: submission.level,
							levelLabel: block.levels.find(
								(entry) => entry.level === submission.level,
							)?.label,
							submittedAt: submission.submittedAt,
							score: {
								timeSeconds: submission.timeSeconds,
								rounds: submission.rounds,
								reps: submission.reps,
								timeCapped: submission.timeCapped,
								load: submission.load,
								loadUnit: submission.loadUnit,
							},
						}));

					return (
						<section
							key={block.blockId}
							className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
						>
							<div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
								<div>
									<h2 className="text-sm font-semibold text-white">
										{block.name}
									</h2>
									{block.repScheme && (
										<p className="text-xs text-[var(--accent)]">
											{block.repScheme}
										</p>
									)}
									{formatWodTiming(
										block.type as HostedWodType,
										block.timeCapSeconds,
										block.durationSeconds,
									) && (
										<p className="text-xs text-[var(--text-muted)]">
											{formatWodTiming(
												block.type as HostedWodType,
												block.timeCapSeconds,
												block.durationSeconds,
											)}
										</p>
									)}
									{block.description && (
										<p className="mt-1 text-sm text-[var(--text-muted)]">
											{block.description}
										</p>
									)}
								</div>
								<span className="text-xs uppercase text-[var(--text-muted)]">
									{block.type}
								</span>
							</div>

							<HostedWodLevels levels={block.levels} />

							<HostedLeaderboard
								type={block.type as HostedWodType}
								rows={rows}
								onRemove={(submissionId) =>
									runAction(() =>
										removeSubmission({
											id: submissionId as Id<"hostedWorkoutSubmissions">,
										}),
									)
								}
							/>
						</section>
					);
				})}
			</div>
		</div>
	);
}
