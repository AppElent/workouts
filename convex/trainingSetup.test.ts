/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { readStrengthReferences } from "./lib/strengthReferences";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const squat = "shipped:exercise:barbell-back-squat";
const HOUR = 60 * 60_000;

function setup() {
	const t = convexTest(schema, modules);
	return {
		t,
		alice: t.withIdentity({ subject: "alice" }),
		bob: t.withIdentity({ subject: "bob" }),
	};
}

describe("personal exercises for connected apps", () => {
	const sled = {
		name: "Sled Push",
		muscleGroups: ["Quads", "glutes"],
		category: "compound" as const,
		equipment: "other" as const,
	};

	it("creates once per name and owner, and lists it only for that owner", async () => {
		const { alice, bob } = setup();
		const first = await alice.mutation(api.exercises.ensurePersonal, sled);
		expect(first.created).toBe(true);
		const again = await alice.mutation(api.exercises.ensurePersonal, {
			...sled,
			name: "  sled push ",
			muscleGroups: [],
		});
		expect(again).toEqual({ id: first.id, created: false });
		const own = await alice.query(api.exercises.listPersonal, {
			paginationOpts: { numItems: 10, cursor: null },
		});
		expect(own.page).toEqual([
			expect.objectContaining({
				_id: first.id,
				name: "Sled Push",
				muscleGroups: ["quads", "glutes"],
				isDefault: false,
				userId: "alice",
			}),
		]);
		const other = await bob.query(api.exercises.listPersonal, {
			paginationOpts: { numItems: 10, cursor: null },
		});
		expect(other.page).toEqual([]);
		const bobs = await bob.mutation(api.exercises.ensurePersonal, sled);
		expect(bobs.created).toBe(true);
		expect(bobs.id).not.toBe(first.id);
	});

	it("requires a signed-in caller and a name", async () => {
		const { t, alice } = setup();
		await expect(
			t.mutation(api.exercises.ensurePersonal, sled),
		).rejects.toThrow();
		await expect(
			alice.mutation(api.exercises.ensurePersonal, { ...sled, name: " " }),
		).rejects.toMatchObject({ data: { code: "required", field: "name" } });
	});
});

describe("strength sessions logged afterwards", () => {
	it("dates the session, its Sets, references and the activity at the given times", async () => {
		const { t, alice } = setup();
		const start = Date.now() - 24 * HOUR;
		const sessionId = await alice.mutation(api.workoutSessions.create, {
			name: "Yesterday",
			startTime: start,
		});
		await alice.mutation(api.sets.add, {
			operationId: "past-set-1",
			sessionId,
			exerciseId: squat,
			setNumber: 1,
			reps: 1,
			weight: 140,
			unit: "kg",
			setType: "working",
			loggedAt: start + 10 * 60_000,
		});
		await alice.mutation(api.workoutSessions.finish, {
			id: sessionId,
			endTime: start + HOUR,
		});
		expect(
			await alice.query(api.workoutSessions.getById, { id: sessionId }),
		).toMatchObject({
			date: start,
			startTime: start,
			endTime: start + HOUR,
			status: "completed",
		});
		const [set] = await alice.query(api.sets.listForSession, { sessionId });
		expect(set?.loggedAt).toBe(start + 10 * 60_000);
		const references = await t.run((ctx) =>
			readStrengthReferences(ctx, "alice", squat),
		);
		expect(references.measured).toMatchObject({
			value: 140,
			date: start + 10 * 60_000,
		});
		const activities = await alice.query(api.activities.list, {});
		expect(activities.items[0]).toMatchObject({
			id: sessionId,
			occurredAt: start,
			durationSeconds: 3600,
		});
	});

	it("starts a Routine at a past time", async () => {
		const { alice } = setup();
		const routineId = await alice.mutation(api.routines.create, {
			name: "Legs",
			exercises: [{ exerciseId: squat, defaultSets: 2, defaultReps: 5 }],
		});
		const start = Date.now() - 20 * HOUR;
		const sessionId = await alice.mutation(api.routines.startSession, {
			routineId,
			startTime: start,
		});
		expect(
			await alice.query(api.workoutSessions.getById, { id: sessionId }),
		).toMatchObject({ date: start, startTime: start });
	});

	it("returns the session a past start made when that start is repeated", async () => {
		const { alice } = setup();
		const start = Date.now() - 24 * HOUR;
		const sessionId = await alice.mutation(api.workoutSessions.create, {
			startTime: start,
		});
		await alice.mutation(api.sets.add, {
			operationId: "retry-set-1",
			sessionId,
			exerciseId: squat,
			setNumber: 1,
			reps: 5,
			weight: 100,
			unit: "kg",
			setType: "working",
			loggedAt: start + 60_000,
		});
		await alice.mutation(api.workoutSessions.finish, {
			id: sessionId,
			endTime: start + HOUR,
		});
		expect(
			await alice.mutation(api.workoutSessions.create, { startTime: start }),
		).toBe(sessionId);
		const live = await alice.mutation(api.workoutSessions.create, {});
		expect(
			await alice.mutation(api.workoutSessions.create, { startTime: start }),
		).toBe(sessionId);
		await alice.mutation(api.workoutSessions.cancel, { id: live });
		const other = await alice.mutation(api.workoutSessions.create, {
			startTime: start + 1,
		});
		expect(other).not.toBe(sessionId);
		await alice.mutation(api.workoutSessions.cancel, { id: other });
		// A cancelled start can be logged again.
		const again = await alice.mutation(api.workoutSessions.create, {
			startTime: start + 1,
		});
		expect(again).not.toBe(other);
	});

	it("refuses future times and times before the session started", async () => {
		const { alice } = setup();
		await expect(
			alice.mutation(api.workoutSessions.create, {
				startTime: Date.now() + HOUR,
			}),
		).rejects.toMatchObject({
			data: { code: "tooLarge", field: "startTime" },
		});
		const start = Date.now() - 2 * HOUR;
		const sessionId = await alice.mutation(api.workoutSessions.create, {
			startTime: start,
		});
		const set = {
			sessionId,
			exerciseId: squat,
			setNumber: 1,
			reps: 5,
			weight: 100,
			unit: "kg" as const,
			setType: "working" as const,
		};
		await expect(
			alice.mutation(api.sets.add, {
				...set,
				operationId: "too-early",
				loggedAt: start - HOUR,
			}),
		).rejects.toMatchObject({ data: { code: "tooSmall", field: "loggedAt" } });
		await expect(
			alice.mutation(api.sets.add, {
				...set,
				operationId: "too-late",
				loggedAt: Date.now() + HOUR,
			}),
		).rejects.toMatchObject({ data: { code: "tooLarge", field: "loggedAt" } });
		await alice.mutation(api.sets.add, {
			...set,
			operationId: "on-time",
			loggedAt: start + 60_000,
		});
		await expect(
			alice.mutation(api.workoutSessions.finish, {
				id: sessionId,
				endTime: start - HOUR,
			}),
		).rejects.toMatchObject({ data: { code: "tooSmall", field: "endTime" } });
	});
});

describe("planned sets for an exercise", () => {
	async function activeSession() {
		const context = setup();
		const sessionId = await context.alice.mutation(
			api.workoutSessions.create,
			{},
		);
		return { ...context, sessionId };
	}

	it("stores absolute targets and replaces them on repeat", async () => {
		const { alice, sessionId } = await activeSession();
		const plan = {
			sessionId,
			exerciseId: squat,
			unit: "kg" as const,
			plannedSets: [
				{ reps: 5, weight: 60 },
				{ reps: 5, weight: 80 },
			],
		};
		await alice.mutation(api.workoutSessions.planExercise, plan);
		const result = await alice.mutation(api.workoutSessions.planExercise, plan);
		expect(result.plannedSets).toEqual([
			{ reps: 5, weight: 60, unit: "kg" },
			{ reps: 5, weight: 80, unit: "kg" },
		]);
		const session = await alice.query(api.workoutSessions.getById, {
			id: sessionId,
		});
		expect(session?.exercises).toEqual([
			expect.objectContaining({
				exerciseId: squat,
				plannedSets: result.plannedSets,
			}),
		]);
		expect(await alice.query(api.sets.listForSession, { sessionId })).toEqual(
			[],
		);
	});

	it("resolves percentages from the 1RM saved after the exercise was added", async () => {
		const { alice, sessionId } = await activeSession();
		await alice.mutation(api.workoutSessions.addExercise, {
			sessionId,
			exerciseId: squat,
		});
		await alice.mutation(api.oneRepMaxes.addManual, {
			exerciseId: squat,
			value: 141,
			unit: "kg",
		});
		const result = await alice.mutation(api.workoutSessions.planExercise, {
			sessionId,
			exerciseId: squat,
			unit: "kg",
			plannedSets: [
				{ reps: 5, percentOfOneRepMax: 75 },
				{ reps: 3, percentOfOneRepMax: 85 },
				{ reps: 10, weight: 40 },
			],
		});
		// 105.75 and 119.85 on the barbell's 2.5 kg step.
		expect(result.plannedSets.map((set) => set.weight)).toEqual([105, 120, 40]);
		expect(result.oneRepMax).toEqual({
			value: 141,
			unit: "kg",
			kind: "manual",
		});
		const session = await alice.query(api.workoutSessions.getById, {
			id: sessionId,
		});
		expect(session?.exercises?.[0]?.references?.manual?.value).toBe(141);
	});

	it("keeps the loads when the same plan is repeated after a newer 1RM", async () => {
		const { alice, sessionId } = await activeSession();
		await alice.mutation(api.oneRepMaxes.addManual, {
			exerciseId: squat,
			value: 100,
			unit: "kg",
		});
		const plan = {
			sessionId,
			exerciseId: squat,
			unit: "kg" as const,
			plannedSets: [{ reps: 5, percentOfOneRepMax: 80 }],
		};
		const first = await alice.mutation(api.workoutSessions.planExercise, plan);
		expect(first.plannedSets[0]?.weight).toBe(80);
		await alice.mutation(api.oneRepMaxes.addManual, {
			exerciseId: squat,
			value: 150,
			unit: "kg",
		});
		const retry = await alice.mutation(api.workoutSessions.planExercise, plan);
		expect(retry).toEqual(first);
	});

	it("explains a missing 1RM and an ambiguous target", async () => {
		const { alice, sessionId } = await activeSession();
		await expect(
			alice.mutation(api.workoutSessions.planExercise, {
				sessionId,
				exerciseId: squat,
				unit: "kg",
				plannedSets: [{ reps: 5, percentOfOneRepMax: 70 }],
			}),
		).rejects.toMatchObject({
			data: { code: "unavailable", field: "oneRepMax" },
		});
		await expect(
			alice.mutation(api.workoutSessions.planExercise, {
				sessionId,
				exerciseId: squat,
				unit: "kg",
				plannedSets: [{ reps: 5, weight: 60, percentOfOneRepMax: 70 }],
			}),
		).rejects.toMatchObject({ data: { code: "invalid", field: "weight" } });
	});

	it("is owner-only and only for active sessions", async () => {
		const { t, alice, bob, sessionId } = await activeSession();
		const plan = {
			sessionId,
			exerciseId: squat,
			unit: "kg" as const,
			plannedSets: [{ reps: 5, weight: 60 }],
		};
		await expect(
			t.mutation(api.workoutSessions.planExercise, plan),
		).rejects.toThrow();
		await expect(
			bob.mutation(api.workoutSessions.planExercise, plan),
		).rejects.toThrow();
		await alice.mutation(api.workoutSessions.cancel, { id: sessionId });
		await expect(
			alice.mutation(api.workoutSessions.planExercise, plan),
		).rejects.toMatchObject({ data: { code: "sessionEnded" } });
	});
});
