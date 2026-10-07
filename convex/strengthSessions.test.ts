/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const exerciseId = "shipped:exercise:barbell-bench-press";

describe("strength sessions", () => {
	it("returns a definitive rejection when a drafted personal exercise is deleted", async () => {
		const athlete = convexTest(schema, modules).withIdentity({ subject: "alice" });
		const personal = await athlete.mutation(api.exercises.create, { name: "Personal lift", muscleGroups: [], category: "compound", equipment: "barbell" });
		const sessionId = await athlete.mutation(api.workoutSessions.create, {});
		await athlete.mutation(api.workoutSessions.addExercise, { sessionId, exerciseId: personal });
		await athlete.mutation(api.exercises.remove, { id: personal });
		await expect(athlete.mutation(api.sets.add, { operationId: "deleted-exercise", sessionId, exerciseId: personal, setNumber: 1, reps: 5, weight: 60, unit: "kg", setType: "working" })).rejects.toMatchObject({ data: "Exercise not found" });
		expect(await athlete.query(api.sets.getLogResult, { operationId: "deleted-exercise" })).toBeNull();
		expect(await athlete.query(api.sets.listForSession, { sessionId })).toEqual([]);
	});
 it("rejects invalid prescriptions before creating targets and merges repeated exercises in order", async () => {
  const athlete = convexTest(schema, modules).withIdentity({ subject: "alice" });
  await expect(athlete.mutation(api.routines.create, { name: "Invalid", exercises: [{ exerciseId, defaultSets: 1000000, defaultReps: 8 }] })).rejects.toThrow();
  await expect(athlete.mutation(api.routines.create, { name: "Invalid", exercises: [{ exerciseId, defaultSets: 2.5, defaultReps: 8 }] })).rejects.toThrow();
  const routineId = await athlete.mutation(api.routines.create, { name: "Repeat", exercises: [{ exerciseId, defaultSets: 2, defaultReps: 8 }, { exerciseId, defaultSets: 1, defaultReps: 5 }] });
  const id = await athlete.mutation(api.routines.startSession, { routineId });
  const session = await athlete.query(api.workoutSessions.getById, { id });
  expect(session?.exercises).toHaveLength(1);
  expect(session?.exercises?.[0]?.plannedSets.map(set => set.reps)).toEqual([8, 8, 5]);
 });
 it("rejects fractional reps, invalid numbering and effort outside half steps", async () => {
  const athlete = convexTest(schema, modules).withIdentity({ subject: "alice" });
  const sessionId = await athlete.mutation(api.workoutSessions.create, {});
  const input = { sessionId, exerciseId, setNumber: 1, reps: 8, weight: 60, unit: "kg" as const, setType: "working" as const };
  await expect(athlete.mutation(api.sets.add, { ...input, reps: 2.5 })).rejects.toThrow();
  await expect(athlete.mutation(api.sets.add, { ...input, setNumber: 0 })).rejects.toThrow();
  await expect(athlete.mutation(api.sets.add, { ...input, rpe: 7.3 })).rejects.toThrow();
  expect(await athlete.query(api.sets.listForSession, { sessionId })).toEqual([]);
 });
 it("keeps concurrent start attempts to one active session", async () => {
  const athlete = convexTest(schema, modules).withIdentity({ subject: "alice" });
  const results = await Promise.allSettled([athlete.mutation(api.workoutSessions.create, {}), athlete.mutation(api.workoutSessions.create, {})]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(await athlete.query(api.workoutSessions.listRecent, {})).toHaveLength(1);
 });

	it("preserves the hosted prescription as planned work for participants", async () => {
		const t = convexTest(schema, modules);
		const host = t.withIdentity({ subject: "host" });
		const athlete = t.withIdentity({ subject: "athlete" });
		const hostedId = await host.mutation(api.hostedWorkouts.createDraft, {
			title: "Hosted strength", hostParticipation: "hostOnly",
			template: { strengthBlocks: [{ blockId: "squat", exerciseId, exerciseName: "Bench", defaultSets: 3, defaultReps: 8, defaultWeight: 60 }], wodBlocks: [] },
		});
		await host.mutation(api.hostedWorkouts.open, { id: hostedId });
		const hosted = await host.query(api.hostedWorkouts.getMine, { id: hostedId });
		if (!hosted) throw new Error("Hosted workout missing");
		const sessionId = await athlete.mutation(api.hostedWorkoutParticipants.join, { token: hosted.hosted.joinToken });
		expect(await athlete.query(api.sets.listForSession, { sessionId })).toEqual([]);
		expect((await athlete.query(api.workoutSessions.getById, { id: sessionId }))?.exercises).toMatchObject([{ exerciseId, plannedSets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }] }]);
		expect(await athlete.query(api.hostedWorkoutParticipants.getBySession, { sessionId })).not.toBeNull();
		await host.mutation(api.hostedWorkouts.close, { id: hostedId });
		expect((await athlete.query(api.workoutSessions.getById, { id: sessionId }))?.status).toBe("cancelled");
		expect((await athlete.query(api.activities.list, { sport: "strength" })).items).toEqual([]);
	});

	it("requires acknowledgement of unfinished targets, keeps cancellation logs and rejects late logging", async () => {
		const athlete = convexTest(schema, modules).withIdentity({ subject: "alice" });
		const routineId = await athlete.mutation(api.routines.create, { name: "Plan", exercises: [{ exerciseId, defaultSets: 3, defaultReps: 8 }] });
		const sessionId = await athlete.mutation(api.routines.startSession, { routineId });
		await expect(athlete.mutation(api.workoutSessions.finish, { id: sessionId })).rejects.toThrow("empty");
		await athlete.mutation(api.sets.add, { sessionId, exerciseId, setNumber: 1, reps: 8, weight: 60, unit: "kg", setType: "working" });
		await expect(athlete.mutation(api.workoutSessions.finish, { id: sessionId })).rejects.toThrow("unfinished");
		await athlete.mutation(api.workoutSessions.finish, { id: sessionId, discardUnfinished: true });
		const next = await athlete.mutation(api.workoutSessions.create, {});
		await athlete.mutation(api.sets.add, { sessionId: next, exerciseId, setNumber: 1, reps: 8, weight: 60, unit: "kg", setType: "working" });
		await athlete.mutation(api.workoutSessions.cancel, { id: next });
		expect(await athlete.query(api.sets.listForSession, { sessionId: next })).toHaveLength(1);
		expect((await athlete.query(api.activities.list, { sport: "strength" })).items.map(item => item.id)).toEqual([sessionId]);
		await expect(athlete.mutation(api.sets.add, { sessionId: next, exerciseId, setNumber: 2, reps: 8, weight: 60, unit: "kg", setType: "working" })).rejects.toThrow("ended");
	});

	it("preserves legacy history without treating it or bodyweight load as measured evidence", async () => {
		const t = convexTest(schema, modules);
		const athlete = t.withIdentity({ subject: "alice" });
		const legacy = await t.run(async ctx => {
			const sessionId = await ctx.db.insert("workoutSessions", { userId: "alice", date: 1, startTime: 1, status: "completed" });
			await ctx.db.insert("sets", { userId: "alice", sessionId, exerciseId, setNumber: 1, reps: 1, weight: 300, unit: "kg", setType: "working", loggedAt: 1 });
			await ctx.db.insert("oneRepMaxes", { userId: "alice", exerciseId, value: 300, unit: "kg", date: 1, source: "actual" });
			return sessionId;
		});
		expect((await athlete.query(api.oneRepMaxes.getReferences, { exerciseId })).measured).toBeNull();
		expect(await athlete.query(api.oneRepMaxes.getCurrentForExercise, { exerciseId })).toBeNull();
		expect(await athlete.query(api.oneRepMaxes.listCurrentForUser, {})).toEqual([]);
		expect(await athlete.query(api.oneRepMaxes.listForExercise, { exerciseId })).toMatchObject([{ value: 300, source: "actual" }]);
		expect(await athlete.query(api.sets.listForSession, { sessionId: legacy })).toMatchObject([{ weight: 300, reps: 1, loggedAt: 1 }]);
		const bodyweight = (await athlete.query(api.exercises.list, {})).find(exercise => exercise.equipment === "bodyweight");
		if (!bodyweight) throw new Error("The shipped catalog needs bodyweight exercise");
		const sessionId = await athlete.mutation(api.workoutSessions.create, {});
		const values = { sessionId, exerciseId: bodyweight._id, setNumber: 1, reps: 8, weight: 0, unit: "kg" as const, setType: "working" as const };
		await athlete.mutation(api.sets.add, values);
		await athlete.mutation(api.sets.add, { ...values, setNumber: 2, reps: 1, weight: 20 });
		expect(await athlete.query(api.oneRepMaxes.getReferences, { exerciseId: bodyweight._id })).toMatchObject({ measured: null, estimated: null });
	});

	it("clears saved effort explicitly and repeats into input without recording another Set", async () => {
		const athlete = convexTest(schema, modules).withIdentity({ subject: "alice" });
		const sessionId = await athlete.mutation(api.workoutSessions.create, {});
		const id = await athlete.mutation(api.sets.add, { sessionId, exerciseId, setNumber: 1, reps: 8, weight: 60, unit: "kg", setType: "working", rpe: 7.5 });
		await athlete.mutation(api.sets.update, { id, rpe: null });
		const draft = await athlete.mutation(api.sets.duplicate, { id });
		expect(draft).toMatchObject({ reps: 8, weight: 60, setNumber: 2 });
		const sets = await athlete.query(api.sets.listForSession, { sessionId });
		expect(sets).toHaveLength(1);
		expect(sets[0]).toMatchObject({ reps: 8, weight: 60, unit: "kg", setType: "working" });
		expect(sets[0]?.rpe).toBeUndefined();
	});

	it("freezes reference values and provenance for a session even after correcting or removing the source", async () => {
		const athlete = convexTest(schema, modules).withIdentity({ subject: "alice" });
		const first = await athlete.mutation(api.workoutSessions.create, {});
		const sourceSetId = await athlete.mutation(api.sets.add, { sessionId: first, exerciseId, setNumber: 1, reps: 1, weight: 100, unit: "kg", setType: "working" });
		await athlete.mutation(api.workoutSessions.finish, { id: first });
		const routineId = await athlete.mutation(api.routines.create, { name: "Snapshot", exercises: [{ exerciseId, defaultSets: 1, defaultReps: 8 }] });
		const second = await athlete.mutation(api.routines.startSession, { routineId });
		expect((await athlete.query(api.workoutSessions.getById, { id: second }))?.exercises?.[0]?.references).toMatchObject({ measured: { value: 100, sourceSetId, performance: { weight: 100, reps: 1, unit: "kg" } } });
		await athlete.mutation(api.sets.update, { id: sourceSetId, weight: 110 });
		await athlete.mutation(api.sets.remove, { id: sourceSetId });
		expect((await athlete.query(api.oneRepMaxes.getReferences, { exerciseId })).measured).toBeNull();
		expect((await athlete.query(api.workoutSessions.getById, { id: second }))?.exercises?.[0]?.references).toMatchObject({ measured: { value: 100, sourceSetId, performance: { weight: 100, reps: 1, unit: "kg" } } });
		await athlete.mutation(api.workoutSessions.cancel, { id: second });
		const third = await athlete.mutation(api.routines.startSession, { routineId });
		expect((await athlete.query(api.workoutSessions.getById, { id: third }))?.exercises?.[0]?.references).toMatchObject({ measured: null, estimated: null });
	});

	it("keeps sourced measured, estimated and manual references independent and normalizes units", async () => {
		const athlete = convexTest(schema, modules).withIdentity({ subject: "alice" });
		await athlete.mutation(api.oneRepMaxes.addManual, { exerciseId, value: 90, unit: "kg" });
		const sessionId = await athlete.mutation(api.workoutSessions.create, {});
		const log = { sessionId, exerciseId, setNumber: 1, reps: 1, weight: 100, unit: "kg" as const, setType: "warmup" as const };
		const singleId = await athlete.mutation(api.sets.add, log);
		const multiId = await athlete.mutation(api.sets.add, { ...log, setNumber: 2, reps: 5, weight: 90, setType: "drop" });
		await athlete.mutation(api.sets.add, { ...log, setNumber: 3, weight: 200, unit: "lbs", setType: "failure" });
		await athlete.mutation(api.sets.add, { ...log, setNumber: 4, weight: 200, reps: 0 });
		await athlete.mutation(api.workoutSessions.cancel, { id: sessionId });
		const sets = await athlete.query(api.sets.listForSession, { sessionId });
		expect(await athlete.query(api.oneRepMaxes.getReferences, { exerciseId })).toMatchObject({
			measured: { value: 100, unit: "kg", sourceSetId: singleId, date: sets[0]?.loggedAt },
			estimated: { value: 105, unit: "kg", sourceSetId: multiId, date: sets[1]?.loggedAt, formula: "epley" },
			manual: { value: 90, unit: "kg", source: "manual" },
		});
		await athlete.mutation(api.sets.update, { id: singleId, weight: 80 });
		expect((await athlete.query(api.oneRepMaxes.getReferences, { exerciseId })).measured).toMatchObject({ value: 200, unit: "lbs" });
		await athlete.mutation(api.sets.remove, { id: multiId });
		expect((await athlete.query(api.oneRepMaxes.getReferences, { exerciseId })).estimated).toBeNull();
	});

	it("recovers an acknowledged Log after ending or deleting without duplicating performance", async () => {
		const t = convexTest(schema, modules);
		const athlete = t.withIdentity({ subject: "alice" });
		const sessionId = await athlete.mutation(api.workoutSessions.create, {});
		const input = { sessionId, exerciseId, operationId: "device-log-1", setNumber: 1, reps: 5, weight: 70, unit: "kg" as const, setType: "working" as const };
		const id = await athlete.mutation(api.sets.add, input);
		expect(await athlete.mutation(api.sets.add, input)).toBe(id);
		await expect(athlete.mutation(api.sets.add, { ...input, weight: 80 })).rejects.toThrow("different details");
		expect(await t.withIdentity({ subject: "bob" }).query(api.sets.getLogResult, { operationId: input.operationId })).toBeNull();
		await athlete.mutation(api.workoutSessions.finish, { id: sessionId });
		expect(await athlete.mutation(api.sets.add, input)).toBe(id);
		await expect(athlete.mutation(api.sets.add, { ...input, operationId: "another-log" })).rejects.toThrow("ended");
		await athlete.mutation(api.sets.remove, { id });
		expect(await athlete.query(api.sets.getLogResult, { operationId: input.operationId })).toMatchObject({ setId: id, status: "removed" });
		expect(await athlete.mutation(api.sets.add, input)).toBe(id);
		expect(await athlete.query(api.sets.listForSession, { sessionId })).toEqual([]);
	});

	it("persists exercise order before logging and records only an explicit Log", async () => {
		const t = convexTest(schema, modules);
		const athlete = t.withIdentity({ subject: "alice" });
		const sessionId = await athlete.mutation(api.workoutSessions.create, {});
		const squat = "shipped:exercise:barbell-back-squat";
		await athlete.mutation(api.workoutSessions.addExercise, { sessionId, exerciseId });
		await athlete.mutation(api.workoutSessions.addExercise, { sessionId, exerciseId: squat });
		await athlete.mutation(api.workoutSessions.addExercise, { sessionId, exerciseId });
		expect((await athlete.query(api.workoutSessions.getById, { id: sessionId }))?.exercises?.map((exercise) => exercise.exerciseId)).toEqual([exerciseId, squat]);
		expect(await athlete.query(api.sets.listForSession, { sessionId })).toEqual([]);
		await athlete.mutation(api.sets.add, { sessionId, exerciseId, setNumber: 1, reps: 8, weight: 60, unit: "kg", setType: "working" });
		expect(await athlete.query(api.sets.listForSession, { sessionId })).toMatchObject([{ reps: 8, weight: 60 }]);
		await expect(t.withIdentity({ subject: "bob" }).mutation(api.workoutSessions.addExercise, { sessionId, exerciseId })).rejects.toThrow("Unauthorized");
	});

	it("starts a three-by-eight Routine as targets with no performed Sets", async () => {
		const athlete = convexTest(schema, modules).withIdentity({ subject: "alice" });
		const exercises = await athlete.query(api.exercises.list, {});
		const exercise = exercises.find((item) => item.equipment === "barbell");
		if (!exercise) throw new Error("The shipped catalog needs a barbell exercise");
		const routineId = await athlete.mutation(api.routines.create, {
			name: "Three by eight",
			exercises: [{ exerciseId: exercise._id, defaultSets: 3, defaultReps: 8, defaultWeight: 60 }],
		});
		const sessionId = await athlete.mutation(api.routines.startSession, { routineId });
		expect(await athlete.query(api.sets.listForSession, { sessionId })).toEqual([]);
		expect(await athlete.query(api.workoutSessions.getById, { id: sessionId })).toMatchObject({
			name: "Three by eight",
			exercises: [{ exerciseId: exercise._id, plannedSets: [
				{ reps: 8, weight: 60, unit: "kg" },
				{ reps: 8, weight: 60, unit: "kg" },
				{ reps: 8, weight: 60, unit: "kg" },
			] }],
		});
	});
});

it("returns ordered previous-session performance without leaking another account", async () => {
 const t = convexTest(schema, modules);
 const athlete = t.withIdentity({ subject: "alice" });
 const first = await athlete.mutation(api.workoutSessions.create, {});
 const log = { exerciseId, reps: 8, weight: 60, unit: "kg" as const, setType: "working" as const };
 await athlete.mutation(api.sets.add, { ...log, sessionId: first, setNumber: 1 });
 await athlete.mutation(api.sets.add, { ...log, sessionId: first, setNumber: 2, weight: 65 });
 await athlete.mutation(api.workoutSessions.cancel, { id: first });
 const second = await athlete.mutation(api.workoutSessions.create, {});
 await athlete.mutation(api.sets.add, { ...log, sessionId: second, setNumber: 1, weight: 70 });
 expect(await athlete.query(api.sets.getPreviousForExercise, { exerciseId, sessionId: second })).toMatchObject([{ weight: 60, setNumber: 1 }, { weight: 65, setNumber: 2 }]);
 expect(await t.withIdentity({ subject: "bob" }).query(api.sets.getPreviousForExercise, { exerciseId, sessionId: second })).toEqual([]);
});
