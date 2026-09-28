/// <reference types="vite/client" />
import { SHIPPED_EXERCISES } from "@workouts/core/exercises";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const values = { name: "Paused press", muscleGroups: ["chest", "triceps"], category: "compound" as const, equipment: "barbell" as const };

it("updates in place, clears optional fields, and preserves instructions and training references", async () => {
 const t = convexTest(schema, modules);
 const alice = t.withIdentity({ subject: "alice" });
 const id = await alice.mutation(api.exercises.create, { ...values, notes: "Old", weightIncrement: 2.5, instructions: ["Pause at the bottom."] });
 const setId = await t.run(async ctx => {
  const sessionId = await ctx.db.insert("workoutSessions", { userId: "alice", date: 1, startTime: 1, status: "completed" });
  return ctx.db.insert("sets", { userId: "alice", sessionId, exerciseId: id, setNumber: 1, reps: 5, weight: 80, unit: "kg", setType: "working", loggedAt: 1 });
 });
 await alice.mutation(api.exercises.update, { id, ...values, name: " Edited press " });
 const exercise = await alice.query(api.exercises.getById, { id });
 expect(exercise).toMatchObject({ _id: id, name: "Edited press", isDefault: false, userId: "alice", instructions: ["Pause at the bottom."] });
 expect(exercise?.notes).toBeUndefined();
 expect(exercise?.weightIncrement).toBeUndefined();
 expect(await t.run(ctx => ctx.db.get(setId))).toMatchObject({ exerciseId: id, weight: 80, reps: 5 });
});

it("rejects unauthenticated, other-owner, shipped and legacy-default edits", async () => {
 const t = convexTest(schema, modules);
 const alice = t.withIdentity({ subject: "alice" });
 const id = await alice.mutation(api.exercises.create, values);
 await expect(t.mutation(api.exercises.update, { id, ...values })).rejects.toThrow("Unauthenticated");
 await expect(t.withIdentity({ subject: "bob" }).mutation(api.exercises.update, { id, ...values })).rejects.toThrow("Unauthorized");
 await expect(alice.mutation(api.exercises.update, { id: SHIPPED_EXERCISES[0]._id, ...values })).rejects.toThrow("Cannot edit a shipped exercise");
 const legacy = await t.run(ctx => ctx.db.insert("exercises", { ...values, isDefault: true, userId: "alice" }));
 await expect(alice.mutation(api.exercises.update, { id: legacy, ...values })).rejects.toThrow("Cannot edit default exercises");
 expect(await alice.query(api.exercises.getById, { id })).toMatchObject(values);
});

it("creates an independent personal copy including instructions and validates edits", async () => {
 const t = convexTest(schema, modules);
 const alice = t.withIdentity({ subject: "alice" });
 const source = SHIPPED_EXERCISES[0];
 const id = await alice.mutation(api.exercises.create, { name: `${source.name} (copy)`, muscleGroups: source.muscleGroups, category: source.category, equipment: source.equipment, instructions: source.instructions, notes: source.notes, weightIncrement: source.weightIncrement });
 expect(id).not.toBe(source._id);
 expect(await alice.query(api.exercises.getById, { id })).toMatchObject({ isDefault: false, userId: "alice", muscleGroups: source.muscleGroups, instructions: source.instructions });
 expect(await alice.query(api.exercises.getHistory, { exerciseId: id })).toEqual([]);
 for (const input of [{ ...values, name: " " }, { ...values, weightIncrement: -1 }]) {
  await expect(alice.mutation(api.exercises.update, { id, ...input })).rejects.toThrow();
 }
 expect(await alice.query(api.exercises.getById, { id: source._id })).toMatchObject({ name: source.name, isDefault: true });
});
