/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { SHIPPED_EXERCISES } from "@workouts/core/exercises";
import { calculateOneRepMax } from "@workouts/core";
import { api } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.*s");

it("keeps latest-set and best-estimate answers correct as history grows", async () => {
 const t = convexTest(schema, modules);
 const alice = t.withIdentity({ subject: "alice" });
 const exerciseId = SHIPPED_EXERCISES[0]._id;
 const sessionId = await t.run(ctx => ctx.db.insert("workoutSessions", { userId: "alice", status: "active", startTime: 1, date: 1 }));
 const fields = { sessionId, exerciseId, setNumber: 1, reps: 5, weight: 60, unit: "kg" as const, setType: "working" as const };
 for (let i = 0; i < 10; i++) await alice.mutation(api.sets.add, { ...fields, weight: 60 + i });
 const best = await alice.mutation(api.sets.add, { ...fields, weight: 150 });
 const latest = await alice.mutation(api.sets.add, { ...fields, weight: 80 });
 expect((await alice.query(api.sets.getLastForExercise, { exerciseId }))?._id).toBe(latest);
 expect(await t.withIdentity({ subject: "bob" }).query(api.sets.getLastForExercise, { exerciseId })).toBeNull();
 await alice.mutation(api.sets.update, { id: best, weight: 20 });
 const estimates = await alice.query(api.oneRepMaxes.listCurrentForUser, {});
 expect(estimates[0].value).toBe(calculateOneRepMax(80, 5).value);
 await alice.mutation(api.sets.remove, { id: latest });
 expect((await alice.query(api.oneRepMaxes.listCurrentForUser, {}))[0].value).toBe(calculateOneRepMax(69, 5).value);
});


it("orders historical performance by logged time and excludes only the requested current session", async () => {
 const t = convexTest(schema, modules);
 const exerciseId = SHIPPED_EXERCISES[0]._id;
 const seeded = await t.run(async ctx => {
  const older = await ctx.db.insert("workoutSessions", { userId: "alice", status: "completed", startTime: 1, date: 1 });
  const previous = await ctx.db.insert("workoutSessions", { userId: "alice", status: "completed", startTime: 2, date: 2 });
  const current = await ctx.db.insert("workoutSessions", { userId: "alice", status: "active", startTime: 3, date: 3 });
  const values = { userId: "alice", exerciseId, setNumber: 1, reps: 5, weight: 60, unit: "kg" as const, setType: "working" as const };
  const previousSet = await ctx.db.insert("sets", { ...values, sessionId: previous, loggedAt: 20 });
  const currentSet = await ctx.db.insert("sets", { ...values, sessionId: current, loggedAt: 30 });
  // Imported older history may have a later creation time.
  await ctx.db.insert("sets", { ...values, sessionId: older, loggedAt: 10 });
  await ctx.db.insert("sets", { ...values, userId: "bob", sessionId: older, loggedAt: 40 });
  return { current, currentSet, previousSet };
 });
 const alice = t.withIdentity({ subject: "alice" });
 expect((await alice.query(api.sets.getLastForExercise, { exerciseId }))?._id).toBe(seeded.currentSet);
 expect((await alice.query(api.sets.getLastForExercise, { exerciseId, excludeSessionId: seeded.current }))?._id).toBe(seeded.previousSet);
 expect((await alice.query(api.sets.getPreviousForExercise, { exerciseId, sessionId: seeded.current })).map(set => set._id)).toEqual([seeded.previousSet]);
});
