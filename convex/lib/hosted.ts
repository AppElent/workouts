import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { hostedPrescriptions, startSession } from "./strengthSession";

export function toPublicHostedTemplate(
	template: Doc<"hostedWorkouts">["template"],
) {
	return {
		strengthBlocks: template.strengthBlocks.map((block) => {
			const { exerciseId: _exerciseId, ...publicBlock } = block;
			return publicBlock;
		}),
		wodBlocks: template.wodBlocks.map((block) => {
			const { wodId: _wodId, ...publicBlock } = block;
			return publicBlock;
		}),
	};
}

export function toHostedSessionDto(hosted: Doc<"hostedWorkouts">) {
	return {
		title: hosted.title,
		notes: hosted.notes,
		scheduledAt: hosted.scheduledAt,
		status: hosted.status,
		template: {
			strengthBlocks: hosted.template.strengthBlocks,
			wodBlocks: toPublicHostedTemplate(hosted.template).wodBlocks,
		},
	};
}

type HostedTable =
	| "hostedWorkouts"
	| "hostedWorkoutParticipants"
	| "hostedWorkoutSubmissions";

/** For a session recorded after the fact; see `startSession`. */
type Recorded = { startTime: number; endTime?: number };

/** Starts the athlete's own session for the workout. */
export function startHostedSession(
	ctx: MutationCtx,
	hosted: Doc<"hostedWorkouts">,
	userId: string,
	recorded?: Recorded,
) {
	return startSession(ctx, userId, {
		name: hosted.title,
		date: hosted.scheduledAt,
		startTime: recorded?.startTime,
		endTime: recorded?.endTime,
		prescriptions: hostedPrescriptions(hosted.template.strengthBlocks),
	});
}

/** Starts a participant's session for the workout and joins them to it. */
export async function joinHosted(
	ctx: MutationCtx,
	hosted: Doc<"hostedWorkouts">,
	userId: string,
	displayName: string | undefined,
	recorded?: Recorded,
) {
	const sessionId = await startHostedSession(ctx, hosted, userId, recorded);
	await ctx.db.insert("hostedWorkoutParticipants", {
		hostedWorkoutId: hosted._id,
		userId,
		sessionId,
		joinedAt: Date.now(),
		displayName,
	});
	return sessionId;
}

/**
 * Ends a participant's session if it is still running, so a removed Hosted
 * Workout leaves no one locked out of starting another session: completed when
 * anything was logged, otherwise cancelled.
 */
export async function finishParticipantSession(
	ctx: MutationCtx,
	participant: Doc<"hostedWorkoutParticipants">,
	now = Date.now(),
) {
	const session = await ctx.db.get(participant.sessionId);
	if (session?.status !== "active") return;
	const [set, wod] = await Promise.all([
		ctx.db
			.query("sets")
			.withIndex("by_session", (q) => q.eq("sessionId", session._id))
			.first(),
		ctx.db
			.query("wodResults")
			.withIndex("by_session", (q) => q.eq("sessionId", session._id))
			.first(),
	]);
	await ctx.db.patch(session._id, {
		status: set || wod ? "completed" : "cancelled",
		endTime: now,
	});
}

/**
 * Deletes at most `budget` Hosted Workout rows tied to a deleted account:
 * every event it hosts, whole, with all participants and submissions,
 * guests included, ending the participants' running sessions as `remove` does;
 * then its participation in other hosts' events and every submission linked
 * to it, so its scores leave those leaderboards. Other accounts' sessions, WODs
 * and WOD results are their own rows and stay. Returns the budget left, or
 * `null` when it ran out first; callers repeat, and a repeat resumes.
 */
export async function deleteHostedWorkoutData(
	ctx: MutationCtx,
	userId: string,
	budget: number,
): Promise<number | null> {
	let remaining = budget;
	/** Deletes rows until the budget runs out; false when some are left. */
	async function deleteAll(rows: { _id: Id<HostedTable> }[]) {
		for (const row of rows) {
			if (remaining === 0) return false;
			await ctx.db.delete(row._id);
			remaining -= 1;
		}
		return true;
	}

	const now = Date.now();
	for (;;) {
		const hosted = await ctx.db
			.query("hostedWorkouts")
			.withIndex("by_host", (q) => q.eq("hostUserId", userId))
			.first();
		if (!hosted) break;
		const submissions = await ctx.db
			.query("hostedWorkoutSubmissions")
			.withIndex("by_hosted_workout", (q) =>
				q.eq("hostedWorkoutId", hosted._id),
			)
			.take(remaining + 1);
		if (!(await deleteAll(submissions))) return null;
		const participants = await ctx.db
			.query("hostedWorkoutParticipants")
			.withIndex("by_hosted_workout", (q) =>
				q.eq("hostedWorkoutId", hosted._id),
			)
			.take(remaining + 1);
		for (const participant of participants.slice(0, remaining))
			await finishParticipantSession(ctx, participant, now);
		if (!(await deleteAll(participants))) return null;
		if (!(await deleteAll([hosted]))) return null;
	}

	for (;;) {
		const participant = await ctx.db
			.query("hostedWorkoutParticipants")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.first();
		if (!participant) break;
		// Signed-in submissions (`submitForSession`, `claimGuestSubmissions`)
		// carry the participant together with the account's WOD and result, so
		// matching the participant also finds every row pointing at those.
		const linked = await ctx.db
			.query("hostedWorkoutSubmissions")
			.withIndex("by_participant", (q) =>
				q.eq("participantId", participant._id),
			)
			.take(remaining + 1);
		if (!(await deleteAll(linked))) return null;
		if (!(await deleteAll([participant]))) return null;
	}
	return remaining;
}
