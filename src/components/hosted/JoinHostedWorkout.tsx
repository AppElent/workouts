import { Show, useAuth, useUser } from "@clerk/react";
import { api } from "@convex/_generated/api";
import { plural } from "@foundry/core";
import { Link, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { History, LogIn, Play, UserPlus } from "lucide-react";
import { useState } from "react";
import { GuestSubmissionForm } from "#/components/hosted/GuestSubmissionForm";
import { getGuestKey } from "#/components/hosted/guestKey";
import {
	HostedStrengthBlocks,
	HostedWodBlockCard,
} from "#/components/hosted/HostedBlocks";
import { useConvexErrorMessage } from "#/lib/convexError";
import { fmt, useI18n } from "#/lib/i18n";

export function JoinHostedWorkout({ token }: { token: string }) {
	const navigate = useNavigate();
	const { isSignedIn } = useAuth();
	const { user } = useUser();
	const data = useQuery(api.hostedWorkouts.getByJoinToken, { token });
	const join = useMutation(api.hostedWorkoutParticipants.join);
	const submitGuest = useMutation(api.hostedWorkoutSubmissions.submitGuest);
	const [guestKey] = useState(getGuestKey);
	const guestScores = useQuery(api.hostedWorkoutSubmissions.listGuestScores, {
		token,
		guestKey,
	});
	const errorMessage = useConvexErrorMessage();
	const [joining, setJoining] = useState(false);
	const [joinError, setJoinError] = useState<string | null>(null);
	// Prefill the leaderboard name from the Clerk identity, but let the athlete
	// override it. `nameInput === null` means "not yet edited" so the default
	// tracks the loaded user.
	const defaultName = user?.fullName || user?.username || user?.firstName || "";
	const [nameInput, setNameInput] = useState<string | null>(null);
	const displayName = nameInput ?? defaultName;

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
			setJoinError(errorMessage(err, "Failed to join workout."));
			setJoining(false);
		}
	}

	if (data === undefined) {
		return <div className="p-6 text-sm text-text-muted">Loading...</div>;
	}

	if (data === null) {
		return (
			<div className="p-6 text-sm text-danger">Hosted workout not found.</div>
		);
	}

	const { hosted, submissions } = data;
	const isOpen = hosted.status === "open";

	return (
		<div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:p-6">
			<header className="rounded-lg border border-border bg-surface p-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="text-2xl font-bold text-text">{hosted.title}</h1>
							<span className="rounded-full border border-border px-2 py-1 text-xs uppercase text-text-muted">
								{hosted.status}
							</span>
						</div>
						{hosted.scheduledAt && (
							<p className="mt-1 text-sm text-text-muted">
								{format(new Date(hosted.scheduledAt), "MMM d, h:mm a")}
							</p>
						)}
						{hosted.notes && (
							<p className="mt-3 text-sm text-text-muted">{hosted.notes}</p>
						)}
					</div>

					<Show when="signed-in">
						<div className="flex flex-col gap-2 sm:w-56">
							<label className="flex flex-col gap-1 text-xs font-medium uppercase text-text-muted">
								Your name
								<input
									type="text"
									value={displayName}
									onChange={(event) => setNameInput(event.target.value)}
									placeholder="Name on leaderboard"
									className="h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm normal-case text-text placeholder:text-text-muted"
								/>
							</label>
							<button
								type="button"
								onClick={() => void handleJoin()}
								disabled={!isOpen || joining}
								className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-fill px-4 py-2 text-sm font-bold text-on-accent disabled:opacity-50"
							>
								<Play size={15} />
								{joining ? "Joining..." : "Join workout"}
							</button>
						</div>
					</Show>
					<Show when="signed-out">
						<Link
							to="/sign-in"
							search={{ redirect: `/join/${token}` }}
							className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text"
						>
							<LogIn size={15} />
							Sign in to join
						</Link>
					</Show>
				</div>
				{joinError && <p className="mt-3 text-sm text-danger">{joinError}</p>}
			</header>

			{guestScores && guestScores.length > 0 ? (
				<ClaimGuestScores
					token={token}
					guestKey={guestKey}
					guests={guestScores}
				/>
			) : null}

			<HostedStrengthBlocks blocks={hosted.template.strengthBlocks} />

			<section className="grid gap-4 lg:grid-cols-[320px_1fr]">
				{isOpen ? (
					<GuestSubmissionForm
						wodBlocks={hosted.template.wodBlocks}
						onSubmit={({ guestName, ...payload }) =>
							submitGuest({
								token,
								guestName,
								guestKey,
								...payload,
							})
						}
					/>
				) : (
					<div className="h-fit rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
						{hosted.status === "closed"
							? "This workout has closed. Scores are final."
							: "This workout hasn't started yet. Check back once the host opens it."}
					</div>
				)}

				<div className="flex flex-col gap-4">
					{hosted.template.wodBlocks.map((block) => (
						<HostedWodBlockCard
							key={block.blockId}
							block={block}
							rows={submissions
								.filter((submission) => submission.wodBlockId === block.blockId)
								.map((submission, index) => ({
									id: `${submission.athleteName}-${submission.submittedAt}-${index}`,
									name:
										submission.athleteName ??
										(submission.byHost ? "Host" : "Signed-in athlete"),
									level: submission.level,
									submittedAt: submission.submittedAt,
									score: submission,
								}))}
						/>
					))}
				</div>
			</section>
		</div>
	);
}

/**
 * Offers a guest who scored from this browser to keep those scores: sign up
 * (and come back here), then claim them into their own history. On a shared
 * device each name is claimed on its own, so one athlete never takes another's
 * scores.
 */
function ClaimGuestScores({
	token,
	guestKey,
	guests,
}: {
	token: string;
	guestKey: string;
	guests: { guestName: string; count: number }[];
}) {
	const navigate = useNavigate();
	const { locale, messages } = useI18n();
	const t = messages.hosted.claim;
	const claim = useMutation(api.hostedWorkoutSubmissions.claimGuestSubmissions);
	// Clerk can report signed-in before Convex has the token, right after
	// returning from sign-up; claiming then would be rejected.
	const { isAuthenticated } = useConvexAuth();
	const errorMessage = useConvexErrorMessage();
	const [claiming, setClaiming] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const total = guests.reduce((sum, guest) => sum + guest.count, 0);
	const shared = guests.length > 1;

	async function handleClaim(guestName: string) {
		if (claiming || !isAuthenticated) return;
		setClaiming(guestName);
		setError(null);
		try {
			const { sessionId } = await claim({ token, guestKey, guestName });
			void navigate({ to: "/log/$sessionId", params: { sessionId } });
		} catch (err) {
			setError(errorMessage(err, t.failed));
			setClaiming(null);
		}
	}

	return (
		<section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 className="text-sm font-bold text-text">
					{plural(locale, total, t.title)}
				</h2>
				<Show when="signed-in">
					<p className="mt-1 text-sm text-text-muted">
						{shared ? t.signedInShared : plural(locale, total, t.signedIn)}
					</p>
				</Show>
				<Show when="signed-out">
					<p className="mt-1 text-sm text-text-muted">
						{plural(locale, total, t.signedOut)}
					</p>
				</Show>
				{error && <p className="mt-2 text-sm text-danger">{error}</p>}
			</div>
			<Show when="signed-in">
				<div className="flex shrink-0 flex-col gap-2">
					{guests.map(({ guestName, count }) => (
						<button
							key={guestName}
							type="button"
							onClick={() => void handleClaim(guestName)}
							disabled={claiming !== null || !isAuthenticated}
							className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-fill px-4 py-2 text-sm font-bold text-on-accent disabled:opacity-50"
						>
							<History size={15} />
							{claiming === guestName
								? t.adding
								: shared
									? fmt(t.addAs, { name: guestName, count })
									: t.add}
						</button>
					))}
				</div>
			</Show>
			<Show when="signed-out">
				<Link
					to="/sign-up"
					search={{ redirect: `/join/${token}` }}
					className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-fill px-4 py-2 text-sm font-bold text-on-accent"
				>
					<UserPlus size={15} />
					{t.createAccount}
				</Link>
			</Show>
		</section>
	);
}
