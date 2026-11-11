import { validateExerciseInput } from "@foundry/core";
import {
	paginationOptsValidator,
	paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getOptionalUserId, requireOwned, requireUserId } from "./lib/auth";
import { appError, checked } from "./lib/errors";
import {
	exerciseDocument,
	exerciseOneRepMaxes,
	exerciseSets,
	resolveExercise,
} from "./lib/exerciseCatalog";
import { exerciseReference } from "./lib/validators";

export const listPersonal = query({
	args: { paginationOpts: paginationOptsValidator },
	returns: paginationResultValidator(exerciseDocument),
	handler: async (ctx, { paginationOpts }) => {
		const userId = await getOptionalUserId(ctx);
		if (!userId) return { page: [], isDone: true, continueCursor: "" };
		return ctx.db
			.query("exercises")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.paginate(paginationOpts);
	},
});

export const getById = query({
	args: { id: exerciseReference },
	returns: v.union(
		v.null(),
		v.object({ ...exerciseDocument.fields, _id: exerciseReference }),
	),
	handler: async (ctx, { id }) => {
		return resolveExercise(ctx, id, await getOptionalUserId(ctx));
	},
});

export const getHistory = query({
	args: { exerciseId: exerciseReference },
	handler: async (ctx, { exerciseId }) => {
		const userId = await requireUserId(ctx);
		const userSets = await exerciseSets(ctx, userId, exerciseId);
		const result = [];
		for (const set of userSets) {
			const session = await ctx.db.get(set.sessionId);
			result.push({
				...set,
				sessionDate: session?.date ?? set.loggedAt,
				sessionName: session?.name ?? null,
			});
		}
		return result.sort((a, b) => a.loggedAt - b.loggedAt);
	},
});

const exerciseInput = {
	name: exerciseDocument.fields.name,
	muscleGroups: exerciseDocument.fields.muscleGroups,
	category: exerciseDocument.fields.category,
	equipment: exerciseDocument.fields.equipment,
	notes: exerciseDocument.fields.notes,
	weightIncrement: exerciseDocument.fields.weightIncrement,
};

/** A personal exercise the caller owns; shipped ones are `readOnly`. */
async function requirePersonalExercise(
	ctx: MutationCtx,
	userId: string,
	id: string,
) {
	const documentId = ctx.db.normalizeId("exercises", id);
	if (!documentId) throw appError("readOnly");
	return requireOwned(ctx, userId, documentId);
}

export const create = mutation({
	args: {
		...exerciseInput,
		instructions: exerciseDocument.fields.instructions,
	},
	returns: v.id("exercises"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const exercise = checked(validateExerciseInput(args));
		return ctx.db.insert("exercises", {
			...exercise,
			isDefault: false,
			userId,
		});
	},
});

export const update = mutation({
	args: { id: exerciseReference, ...exerciseInput },
	returns: v.null(),
	handler: async (ctx, { id, ...args }) => {
		const userId = await requireUserId(ctx);
		const exercise = checked(validateExerciseInput(args));
		const { _id: documentId } = await requirePersonalExercise(ctx, userId, id);
		// Patch in place: sets, records, routines and instructions keep their identity.
		// An explicit undefined clears notes and weight increment.
		await ctx.db.patch(documentId, exercise);
		return null;
	},
});

export const remove = mutation({
	args: { id: exerciseReference },
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		const { _id: documentId } = await requirePersonalExercise(ctx, userId, id);
		const rows = [
			...(await exerciseSets(ctx, userId, id)),
			...(await exerciseOneRepMaxes(ctx, userId, id)),
		];
		for (const row of rows) await ctx.db.delete(row._id);
		await ctx.db.delete(documentId);
	},
});
