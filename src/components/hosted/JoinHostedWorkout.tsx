import { SignedIn, SignedOut, useAuth, useUser } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { LogIn, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { GuestSubmissionForm } from "#/components/hosted/GuestSubmissionForm";
import { HostedLeaderboard } from "#/components/hosted/HostedLeaderboard";
import { HostedWodLevels } from "#/components/hosted/HostedWodLevels";
import { getConvexErrorMessage } from "#/lib/convexError";
import {
	formatWodTiming,
	type HostedLeaderboardRow,
	type HostedWodType,
} from "#/lib/hostedWorkouts";

export function JoinHostedWorkout({ token }: { token: string }) {
	const navigate = useNavigate();
	const { isSignedIn } = useAuth();
	const { user } = useUser();
	const data = useQuery(api.hostedWorkouts.getByJoinToken, { token });
	const join = useMutation(api.hostedWorkoutParticipants.join);
	const submitGuest = useMutation(api.hostedWorkoutSubmissions.submitGuest);
	const [joining, setJoining] = useState(false);
	const [joinError, setJoinError] = useState<string | null>(null);
	// Prefill the leaderboard name from the Clerk identity, but let the athlete
	// override it. `nameInput === null` means "not yet edited" so the default
	// tracks the loaded user.
	const defaultName = user?.fullName || user?.username || user?.firstName || "";
	const [nameInput, setNameInput] = useState<string | null>(null);
	const displayName = nameInput ?? defaultName;

	const wodBlocks = useMemo(
		() =>
			data?.hosted.template.wodBlocks.map((block) => ({
				blockId: block.blockId,
				name: block.name,
				type: block.type as HostedWodType,
				levels: block.levels.map((level) => ({
					level: level.level,
					label: level.label,
					movements: level.movements,
				})),
			})) ?? [],
		[data?.hosted.template.wodBlocks],
	);

	async function handleJoin() {
		if (!isSignedIn || joining) return;
		setJoining(true);
		setJoinError(null);
		try {
			const sessionId = await join({
				token,
				displayName: displayName.trim() || undefined,
			});
			void navigate({ to: "/log/$sessionId", params: { sessionId } });
		} catch (err) {
			setJoinError(getConvexErrorMessage(err, "Failed to join workout."));
			setJoining(false);
		}
	}

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

	const { hosted, submissions } = data;
	const isOpen = hosted.status === "open";

	return (
		<div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:p-6">
			<header className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="text-2xl font-bold text-white">{hosted.title}</h1>
							<span className="rounded-full border border-[var(--border)] px-2 py-1 text-xs uppercase text-[var(--text-muted)]">
								{hosted.status}
							</span>
						</div>
						{hosted.scheduledAt && (
							<p className="mt-1 text-sm text-[var(--text-muted)]">
								{format(new Date(hosted.scheduledAt), "MMM d, h:mm a")}
							</p>
						)}
						{hosted.notes && (
							<p className="mt-3 text-sm text-[var(--text-muted)]">
								{hosted.notes}
							</p>
						)}
					</div>

					<SignedIn>
						<div className="flex flex-col gap-2 sm:w-56">
							<label className="flex flex-col gap-1 text-xs font-medium uppercase text-[var(--text-muted)]">
								Your name
								<input
									type="text"
									value={displayName}
									onChange={(event) => setNameInput(event.target.value)}
									placeholder="Name on leaderboard"
									className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm normal-case text-white placeholder:text-[var(--text-muted)]"
								/>
							</label>
							<button
								type="button"
								onClick={() => void handleJoin()}
								disabled={!isOpen || joining}
								className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
							>
								<Play size={15} />
								{joining ? "Joining..." : "Join workout"}
							</button>
						</div>
					</SignedIn>
					<SignedOut>
						<Link
							to="/sign-in"
							className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-white"
						>
							<LogIn size={15} />
							Sign in to join
						</Link>
					</SignedOut>
				</div>
				{joinError && <p className="mt-3 text-sm text-red-400">{joinError}</p>}
			</header>

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

			<section className="grid gap-4 lg:grid-cols-[320px_1fr]">
				{isOpen ? (
					<GuestSubmissionForm
						wodBlocks={wodBlocks}
						onSubmit={({ guestName, ...payload }) =>
							submitGuest({
								token,
								guestName,
								...payload,
							})
						}
					/>
				) : (
					<div className="h-fit rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
						{hosted.status === "closed"
							? "This workout has closed. Scores are final."
							: "This workout hasn't started yet. Check back once the host opens it."}
					</div>
				)}

				<div className="flex flex-col gap-4">
					{hosted.template.wodBlocks.map((block) => {
						const rows: HostedLeaderboardRow[] = submissions
							.filter((submission) => submission.wodBlockId === block.blockId)
							.map((submission, index) => ({
								id: `${submission.athleteName}-${submission.submittedAt}-${index}`,
								name: submission.athleteName,
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
								<div className="flex items-start justify-between gap-3">
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
									</div>
									<span className="text-xs uppercase text-[var(--text-muted)]">
										{block.type}
									</span>
								</div>
								<HostedWodLevels levels={block.levels} />
								<HostedLeaderboard
									type={block.type as HostedWodType}
									rows={rows}
								/>
							</section>
						);
					})}
				</div>
			</section>
		</div>
	);
}
