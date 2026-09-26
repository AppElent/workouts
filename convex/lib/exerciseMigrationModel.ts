import { defineTable } from "convex/server";
import { v } from "convex/values";

export const migrationPhase = v.union(
	v.literal("defaults"),
	v.literal("sets"),
	v.literal("oneRepMaxes"),
	v.literal("routines"),
	v.literal("hostedWorkouts"),
	v.literal("finalize"),
	v.literal("complete"),
	v.literal("blocked"),
);
export const migrationFields = {
	key: v.literal("shipped-v1"),
	generation: v.number(),
	dryRun: v.boolean(),
	phase: migrationPhase,
	verifying: v.boolean(),
	cursor: v.union(v.string(), v.null()),
	batchSize: v.number(),
	mappings: v.record(v.string(), v.string()),
	scanned: v.record(v.string(), v.number()),
	changed: v.record(v.string(), v.number()),
	mappedExercises: v.optional(v.number()),
	error: v.optional(v.string()),
	startedAt: v.number(),
	completedAt: v.optional(v.number()),
};
export const exerciseMigrationTable = defineTable(migrationFields).index(
	"by_key",
	["key"],
);
