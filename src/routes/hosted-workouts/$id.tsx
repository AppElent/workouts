import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { ArrowLeft, Clipboard, Lock, Play, Radio, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import {
	formatHostedScore,
	getHostedLevelLabel,
	sortHostedLeaderboard,
	type HostedLeaderboardRow,
	type HostedWodType,
} from "#/lib/hostedWorkouts";

export const Route = createFileRoute("/hosted-workouts/$id")({
	component: HostedWorkoutDetailGuarded,
});

function HostedWorkoutDetailGuarded() {
	return (
		<>
			<SignedIn>
				<HostedWorkoutDetailPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function HostedWorkoutDetailPage() {
	const { id } = Route.useParams();
	const hostedWorkoutId = id as Id<"hostedWorkouts">;
	const data = useQuery(api.hostedWorkouts.getMine, { id: hostedWorkoutId });
	const openHostedWorkout = useMutation(api.hostedWorkouts.open);
	const closeHostedWorkout = useMutation(api.hostedWorkouts.close);
	const removeSubmission = useMutation(api.hostedWorkoutSubmissions.remove);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const joinUrl = useMemo(() => {
		if (!data?.hosted.joinToken) return "";
		if (typeof window === "undefined")
			return `/join-hosted/${data.hosted.joinToken}`;
		return `${window.location.origin}/join-hosted/${data.hosted.joinToken}`;
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
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		}
	}

	async function copyJoinLink() {
		if (!joinUrl || typeof navigator === "undefined") return;
		await navigator.clipboard.writeText(joinUrl);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1600);
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
							<button
								type="button"
								onClick={() =>
									runAction(() => openHostedWorkout({ id: hosted._id }))
								}
								className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-black"
							>
								<Play size={15} /> Open
							</button>
						)}
						{hosted.status === "open" && (
							<button
								type="button"
								onClick={() =>
									runAction(() => closeHostedWorkout({ id: hosted._id }))
								}
								className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-white"
							>
								<Lock size={15} /> Close
							</button>
						)}
					</div>
				</div>
				{error && <p className="mt-3 text-sm text-red-400">{error}</p>}
			</div>

			<div className="grid gap-4 lg:grid-cols-[280px_1fr]">
				<section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
					<div className="flex items-center gap-2 text-sm font-semibold text-white">
						<Radio size={16} />
						Join code
					</div>
					<div className="mt-4 flex justify-center rounded-lg bg-white p-3">
						{joinUrl && <QRCodeSVG value={joinUrl} size={220} />}
					</div>
					<div className="mt-3 break-all rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
						{joinUrl}
					</div>
					<button
						type="button"
						onClick={copyJoinLink}
						className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-white"
					>
						<Clipboard size={15} />
						{copied ? "Copied" : "Copy link"}
					</button>
				</section>

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
					const sortedRows = sortHostedLeaderboard(
						block.type as HostedWodType,
						rows,
					);

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

							<div className="mt-4 grid gap-2 sm:grid-cols-4">
								{block.levels.map((level) => (
									<div
										key={level.level}
										className="rounded-lg border border-[var(--border)] px-3 py-2"
									>
										<p className="text-xs font-semibold text-white">
											{level.label || getHostedLevelLabel(level.level)}
										</p>
										<p className="mt-1 text-xs text-[var(--text-muted)]">
											{level.movements
												.map((movement) => movement.name)
												.join(", ") || "No movements"}
										</p>
									</div>
								))}
							</div>

							<div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]">
								<div className="grid grid-cols-[44px_1fr_76px_92px_44px] gap-2 border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase text-[var(--text-muted)]">
									<span>#</span>
									<span>Athlete</span>
									<span>Level</span>
									<span>Score</span>
									<span />
								</div>
								{sortedRows.length === 0 && (
									<p className="px-3 py-4 text-sm text-[var(--text-muted)]">
										No scores yet.
									</p>
								)}
								{sortedRows.map((row, index) => (
									<div
										key={row.id}
										className="grid grid-cols-[44px_1fr_76px_92px_44px] items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-sm last:border-0"
									>
										<span className="text-[var(--text-muted)]">
											{index + 1}
										</span>
										<span className="font-medium text-white">{row.name}</span>
										<span className="text-[var(--text-muted)]">
											{getHostedLevelLabel(row.level)}
										</span>
										<span className="text-white">
											{formatHostedScore(
												block.type as HostedWodType,
												row.score,
											)}
										</span>
										<button
											type="button"
											aria-label="Remove score"
											onClick={() =>
												runAction(() =>
													removeSubmission({
														id: row.id as Id<"hostedWorkoutSubmissions">,
													}),
												)
											}
											className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-300"
										>
											<Trash2 size={15} />
										</button>
									</div>
								))}
							</div>
						</section>
					);
				})}
			</div>
		</div>
	);
}
