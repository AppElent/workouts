/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import {
	SHIPPED_EXERCISES,
	mergeExerciseCatalog,
} from "@workouts/core/exercises";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const shipped = SHIPPED_EXERCISES[0];
const setFields = {
	setNumber: 1,
	reps: 5,
	weight: 60,
	unit: "kg" as const,
	setType: "working" as const,
};

describe("shipped exercise references", () => {
	it("never seeds catalog documents and returns only personal data to new clients", async () => {
		const t = convexTest(schema, modules);
		expect(await t.mutation(internal.seed.seedExercises, {})).toEqual({
			shipped: true,
		});
		expect(await t.mutation(internal.seed.seedExercises, {})).toEqual({
			shipped: true,
		});
		expect(await t.run((ctx) => ctx.db.query("exercises").collect())).toEqual(
			[],
		);
		const personal = await t.query(api.exercises.listPersonal, {
			paginationOpts: { numItems: 100, cursor: null },
		});
		expect(personal.page).toEqual([]);
		expect(mergeExerciseCatalog(personal.page)).toHaveLength(
			673,
		);
	});

	it("logs, calculates PRs, starts routines, and exports shipped exercises without inserting them", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const routineId = await alice.mutation(api.routines.create, {
			name: "Shipped",
			exercises: [
				{
					exerciseId: shipped._id,
					defaultSets: 1,
					defaultReps: 5,
					defaultWeight: 60,
				},
			],
		});
		const sessionId = await alice.mutation(api.routines.startSession, {
			routineId,
		});
		const setId = await alice.mutation(api.sets.add, {
			...setFields,
			sessionId,
			exerciseId: shipped._id,
		});
		expect(
			await alice.query(api.oneRepMaxes.getCurrentForExercise, {
				exerciseId: shipped._id,
			}),
		).toMatchObject({ exerciseId: shipped._id, value: 70 });
		expect(
			(await alice.query(api.exercises.getHistory, { exerciseId: shipped._id }))
				.length,
		).toBe(2);
		expect(
			await alice.query(api.sets.getLastForExercise, {
				exerciseId: shipped._id,
			}),
		).toMatchObject({ _id: setId });
		expect(
			await alice.query(api.progress.weeklyVolume, { exerciseId: shipped._id }),
		).toHaveLength(1);
		expect(
			(await alice.query(api.routines.list, {}))[0].exercises[0].exerciseName,
		).toBe(shipped.name);
		expect(
			(await alice.query(api.exportData.allData, {})).exercises,
		).toContainEqual({ _id: shipped._id, name: shipped.name });
		await alice.mutation(api.sets.update, { id: setId, weight: 80 });
		expect(
			(
				await alice.query(api.oneRepMaxes.getCurrentForExercise, {
					exerciseId: shipped._id,
				})
			)?.value,
		).toBeGreaterThan(90);
		await alice.mutation(api.sets.remove, { id: setId });
		expect(await t.run((ctx) => ctx.db.query("exercises").collect())).toEqual(
			[],
		);
	});

	it("rejects unknown or another person's exercise references", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		const privateId = await bob.mutation(api.exercises.create, {
			name: "Private",
			muscleGroups: ["core"],
			category: "isolation",
			equipment: "bodyweight",
		});
		const sessionId = await alice.mutation(api.workoutSessions.create, {});
		for (const exerciseId of [
			"shipped:exercise:missing",
			"invalid",
			privateId,
		]) {
			await expect(
				alice.mutation(api.sets.add, { ...setFields, sessionId, exerciseId }),
			).rejects.toThrow("Exercise not found");
			await expect(
				alice.mutation(api.routines.create, {
					name: "Invalid",
					exercises: [{ exerciseId, defaultSets: 1, defaultReps: 5 }],
				}),
			).rejects.toThrow("Exercise not found");
			await expect(
				alice.mutation(api.oneRepMaxes.addManual, {
					exerciseId,
					value: 100,
					unit: "kg",
				}),
			).rejects.toThrow("Exercise not found");
		}
		expect(
			await alice.query(api.exercises.getById, { id: privateId }),
		).toBeNull();
		await expect(
			alice.mutation(api.exercises.remove, { id: shipped._id }),
		).rejects.toThrow();
	});
});
