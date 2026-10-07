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
