import type { Doc } from "../_generated/dataModel";
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

/** Starts a participant's session for the workout and joins them to it. */
export async function joinHosted(
	ctx: MutationCtx,
	hosted: Doc<"hostedWorkouts">,
	userId: string,
	displayName: string | undefined,
) {
	const sessionId = await startSession(ctx, userId, {
		name: hosted.title,
		date: hosted.scheduledAt,
		prescriptions: hostedPrescriptions(hosted.template.strengthBlocks),
	});
	await ctx.db.insert("hostedWorkoutParticipants", {
		hostedWorkoutId: hosted._id,
		userId,
		sessionId,
		joinedAt: Date.now(),
		displayName,
	});
	return sessionId;
}
