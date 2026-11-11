import {
	type RxScaled,
	validateWodScore,
	type WodScoreInput,
} from "@foundry/core";
import type { ObjectType } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getOwned } from "./auth";
import { checked } from "./errors";
import { wodDefinitionFields } from "./validators";

type WodDefinitionFields = ObjectType<typeof wodDefinitionFields>;
type WodDefinition = WodDefinitionFields & Pick<Doc<"wods">, "movements">;

const WOD_DEFINITION_KEYS = Object.keys(
	wodDefinitionFields,
) as (keyof WodDefinitionFields)[];

/** The WOD-defining fields of a library WOD or a hosted WOD block. */
export function wodDefinitionOf(
	source: WodDefinitionFields,
): WodDefinitionFields {
	return Object.fromEntries(
		WOD_DEFINITION_KEYS.map((key) => [key, source[key]]),
	) as WodDefinitionFields;
}

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
