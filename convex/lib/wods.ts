import {
	type RxScaled,
	validateWodScore,
	type WodScoreInput,
} from "@foundry/core";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getOwned } from "./auth";
import { checked } from "./errors";

type WodDefinition = Pick<
	Doc<"wods">,
	| "name"
	| "type"
	| "description"
	| "repScheme"
	| "timeCapSeconds"
	| "durationSeconds"
	| "movements"
>;

type Score = WodScoreInput & { notes?: string };

/**
 * Records a scored WOD in the athlete's own library: a personal copy of the
 * WOD and its result. Passing the ids of an earlier recording updates those
 * rows while they still exist; ones the athlete has deleted are made anew.
 */
export async function recordWodResult(
	ctx: MutationCtx,
	userId: string,
	input: {
		wod: WodDefinition;
		sessionId?: Id<"workoutSessions">;
		rxScaled: RxScaled;
		score: Score;
		previous?: { wodId?: Id<"wods">; wodResultId?: Id<"wodResults"> };
	},
) {
	const score = checked(validateWodScore(input.wod.type, input.score));
	const existingWod = input.previous?.wodId
		? await getOwned(ctx, userId, input.previous.wodId)
		: null;
	let wodId: Id<"wods">;
	if (existingWod) {
		wodId = existingWod._id;
		await ctx.db.patch(wodId, input.wod);
	} else
		wodId = await ctx.db.insert("wods", {
			userId,
			isDefault: false,
			...input.wod,
		});
	const result = {
		wodId,
		date: Date.now(),
		rxScaled: input.rxScaled,
		timeSeconds: score.timeSeconds,
		rounds: score.rounds,
		reps: score.reps,
		timeCapped: score.timeCapped,
		load: score.load,
		loadUnit: score.loadUnit,
		notes: score.notes,
	};
	const existingResult = input.previous?.wodResultId
		? await getOwned(ctx, userId, input.previous.wodResultId)
		: null;
	if (existingResult) {
		await ctx.db.patch(existingResult._id, result);
		return { wodId, wodResultId: existingResult._id };
	}
	const wodResultId = await ctx.db.insert("wodResults", {
		userId,
		sessionId: input.sessionId,
		...result,
	});
	return { wodId, wodResultId };
}
