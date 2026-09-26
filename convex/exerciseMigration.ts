import {
	getShippedExercise,
	getShippedExerciseByName,
} from "@workouts/core/exercises";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { migrationFields } from "./lib/exerciseMigrationModel";

// Only operators can run this migration. The cursor and counters commit in the
// same transaction as each page of patches, so retries cannot lose progress.
export const start = internalMutation({
	args: { dryRun: v.boolean(), batchSize: v.optional(v.number()) },
	returns: v.id("exerciseMigrations"),
	handler: async (ctx, { dryRun, batchSize = 100 }) => {
		if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 200)
			throw new Error("batchSize must be between 1 and 200");
		const previous = await ctx.db
			.query("exerciseMigrations")
			.withIndex("by_key", (q) => q.eq("key", "shipped-v1"))
			.unique();
		if (
			previous &&
			previous.phase !== "complete" &&
			previous.phase !== "blocked"
		)
			throw new Error("Migration already running; use resume to continue it");
		if (previous?.phase === "complete" && !previous.dryRun) return previous._id;
		const state = {
			key: "shipped-v1" as const,
			generation: (previous?.generation ?? 0) + 1,
			dryRun,
			phase: "defaults" as const,
			verifying: false,
			cursor: null,
			batchSize,
			mappings: {},
			scanned: {},
			changed: {},
			startedAt: Date.now(),
		};
		const id = previous
			? previous._id
			: await ctx.db.insert("exerciseMigrations", state);
		if (previous) await ctx.db.replace(id, state);
		await ctx.scheduler.runAfter(0, internal.exerciseMigration.step, {
			generation: state.generation,
		});
		return id;
	},
});

export const status = internalQuery({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			_id: v.id("exerciseMigrations"),
			_creationTime: v.number(),
			...migrationFields,
		}),
	),
	handler: (ctx) =>
		ctx.db
			.query("exerciseMigrations")
			.withIndex("by_key", (q) => q.eq("key", "shipped-v1"))
			.unique(),
});

export const resume = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const state = await ctx.db
			.query("exerciseMigrations")
			.withIndex("by_key", (q) => q.eq("key", "shipped-v1"))
			.unique();
		if (!state) throw new Error("Start the migration first");
		if (state.phase === "blocked")
			throw new Error(
				state.error ?? "Migration blocked; fix the data and start a new run",
			);
		if (state.phase !== "complete")
			await ctx.scheduler.runAfter(0, internal.exerciseMigration.step, {
				generation: state.generation,
			});
		return null;
	},
});

export const step = internalMutation({
	args: { generation: v.number() },
	returns: v.null(),
	handler: async (ctx, { generation }) => {
		const state = await ctx.db
			.query("exerciseMigrations")
			.withIndex("by_key", (q) => q.eq("key", "shipped-v1"))
			.unique();
		if (
			!state ||
			state.generation !== generation ||
			state.phase === "complete" ||
			state.phase === "blocked"
		)
			return null;
		const opts = { numItems: state.batchSize, cursor: state.cursor };
		const mappings = { ...state.mappings };
		let scanned = 0;
		let changed = 0;
		let done = false;
		let cursor = "";
		let error: string | undefined;
		const reference = (id: string) => mappings[id] ?? id;

		if (state.phase === "defaults" || state.phase === "finalize") {
			const page = await ctx.db
				.query("exercises")
				.withIndex("by_default", (q) => q.eq("isDefault", true))
				.paginate(opts);
			done = page.isDone;
			cursor = page.continueCursor;
			scanned = page.page.length;
			for (const exercise of page.page) {
				const shipped = exercise.shippedExerciseId
					? getShippedExercise(exercise.shippedExerciseId)
					: getShippedExerciseByName(exercise.name);
				if (!shipped) {
					error = `Unmapped default exercise ${exercise._id} (${exercise.name}). Reconcile it with the shipped catalog, then restart. No references to this exercise were changed.`;
					break;
				}
				mappings[exercise._id] = shipped._id;
				if (
					state.phase === "finalize" &&
					exercise.shippedExerciseId !== shipped._id
				) {
					await ctx.db.patch(exercise._id, { shippedExerciseId: shipped._id });
				}
			}
		} else if (state.phase === "sets" || state.phase === "oneRepMaxes") {
			const page = await ctx.db.query(state.phase).paginate(opts);
			done = page.isDone;
			cursor = page.continueCursor;
			scanned = page.page.length;
			for (const record of page.page) {
				const exerciseId = reference(record.exerciseId);
				if (exerciseId === record.exerciseId) continue;
				changed++;
				if (!state.dryRun && !state.verifying)
					await ctx.db.patch(record._id, { exerciseId });
			}
		} else if (state.phase === "routines") {
			const page = await ctx.db.query("routines").paginate(opts);
			done = page.isDone;
			cursor = page.continueCursor;
			scanned = page.page.length;
			for (const record of page.page) {
				const exercises = record.exercises.map((exercise) => ({
					...exercise,
					exerciseId: reference(exercise.exerciseId),
				}));
				if (
					!exercises.some(
						(exercise, index) =>
							exercise.exerciseId !== record.exercises[index].exerciseId,
					)
				)
					continue;
				changed++;
				if (!state.dryRun && !state.verifying)
					await ctx.db.patch(record._id, { exercises });
			}
		} else {
			const page = await ctx.db.query("hostedWorkouts").paginate(opts);
			done = page.isDone;
			cursor = page.continueCursor;
			scanned = page.page.length;
			for (const record of page.page) {
				const strengthBlocks = record.template.strengthBlocks.map((block) =>
					block.exerciseId
						? { ...block, exerciseId: reference(block.exerciseId) }
						: block,
				);
				if (
					!strengthBlocks.some(
						(block, index) =>
							block.exerciseId !==
							record.template.strengthBlocks[index].exerciseId,
					)
				)
					continue;
				changed++;
				if (!state.dryRun && !state.verifying)
					await ctx.db.patch(record._id, {
						template: { ...record.template, strengthBlocks },
					});
			}
		}

		if (state.verifying && changed)
			error = `Verification found ${changed} remaining legacy references in ${state.phase}. Restart the migration after checking for old writers.`;
		let phase: Doc<"exerciseMigrations">["phase"] = state.phase;
		let verifying = state.verifying;
		if (error) phase = "blocked";
		else if (done) {
			const next = {
				defaults: "sets",
				sets: "oneRepMaxes",
				oneRepMaxes: "routines",
				routines: "hostedWorkouts",
				hostedWorkouts: "complete",
				finalize: "complete",
			} as const;
			phase = next[state.phase];
			if (state.phase === "hostedWorkouts" && !state.dryRun) {
				phase = state.verifying ? "finalize" : "sets";
				verifying = true;
			}
		}
		const counterKey = state.verifying ? `verify:${state.phase}` : state.phase;
		await ctx.db.patch(state._id, {
			phase,
			verifying,
			cursor: done ? null : cursor,
			mappings: phase === "complete" ? {} : mappings,
			mappedExercises: Object.keys(mappings).length,
			scanned: {
				...state.scanned,
				[counterKey]: (state.scanned[counterKey] ?? 0) + scanned,
			},
			changed: {
				...state.changed,
				[counterKey]: (state.changed[counterKey] ?? 0) + changed,
			},
			error,
			...(phase === "complete" ? { completedAt: Date.now() } : {}),
		});
		if (phase !== "complete" && phase !== "blocked")
			await ctx.scheduler.runAfter(0, internal.exerciseMigration.step, {
				generation,
			});
		return null;
	},
});
