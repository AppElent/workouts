/// <reference types="vite/client" />

import { SHIPPED_EXERCISES } from "@foundry/core/exercises";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import {
	MAX_ROUTINE_EXERCISES,
	MAX_ROUTINE_NAME_LENGTH,
	MAX_ROUTINE_TOTAL_SETS,
} from "./routines";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const bench = SHIPPED_EXERCISES[0]._id;
const squat = SHIPPED_EXERCISES[1]._id;

function setup() {
	const t = convexTest(schema, modules);
	return {
		t,
		alice: t.withIdentity({ subject: "alice" }),
		bob: t.withIdentity({ subject: "bob" }),
	};
}

describe("routines", () => {
	it("creates and updates a routine with a trimmed name and resolved exercises", async () => {
		const { alice } = setup();
		const personalId = await alice.mutation(api.exercises.create, {
			name: "Paused bench",
			muscleGroups: ["chest"],
			category: "compound",
			equipment: "barbell",
		});

		const routineId = await alice.mutation(api.routines.create, {
			name: "  Push Day A  ",
			exercises: [
				{
					exerciseId: bench,
					defaultSets: 3,
					defaultReps: 8,
					defaultWeight: 60,
				},
				{ exerciseId: personalId, defaultSets: 2, defaultReps: 6 },
			],
		});

		expect(await alice.query(api.routines.list, {})).toMatchObject([
			{
				_id: routineId,
				name: "Push Day A",
				exercises: [
					{
						exerciseId: bench,
						defaultSets: 3,
						defaultReps: 8,
						defaultWeight: 60,
					},
					{
						exerciseId: personalId,
						exerciseName: "Paused bench",
						defaultSets: 2,
						defaultReps: 6,
					},
				],
			},
		]);

		await alice.mutation(api.routines.update, {
			id: routineId,
			name: "\tUpper A\n",
			exercises: [{ exerciseId: squat, defaultSets: 4, defaultReps: 5 }],
		});

		expect(await alice.query(api.routines.list, {})).toMatchObject([
			{
				_id: routineId,
				name: "Upper A",
				exercises: [{ exerciseId: squat, defaultSets: 4, defaultReps: 5 }],
			},
		]);
	});

	it("rejects unauthenticated and other-owner mutations", async () => {
		const { t, alice, bob } = setup();
		const valid = {
			name: "Push",
			exercises: [{ exerciseId: bench, defaultSets: 3, defaultReps: 8 }],
		};

		await expect(t.query(api.routines.list, {})).rejects.toMatchObject({
			data: { code: "unauthenticated" },
		});
		await expect(t.mutation(api.routines.create, valid)).rejects.toMatchObject({
			data: { code: "unauthenticated" },
		});

		const id = await alice.mutation(api.routines.create, valid);
		await expect(
			t.mutation(api.routines.update, { id, ...valid }),
		).rejects.toMatchObject({ data: { code: "unauthenticated" } });
		await expect(t.mutation(api.routines.remove, { id })).rejects.toMatchObject(
			{ data: { code: "unauthenticated" } },
		);
		await expect(
			t.mutation(api.routines.startSession, { routineId: id }),
		).rejects.toMatchObject({ data: { code: "unauthenticated" } });

		await expect(
			bob.mutation(api.routines.update, { id, ...valid, name: "Stolen" }),
		).rejects.toMatchObject({ data: { code: "notFound" } });
		await expect(
			bob.mutation(api.routines.remove, { id }),
		).rejects.toMatchObject({ data: { code: "notFound" } });

		expect(await alice.query(api.routines.list, {})).toMatchObject([
			{ _id: id, name: "Push" },
		]);
	});

	const entry = { exerciseId: bench, defaultSets: 3, defaultReps: 8 };
	const valid = { name: "Original", exercises: [entry] };

	it("keeps an operation ID available after rejecting a Routine", async () => {
		const { alice } = setup();
		const input = {
			...valid,
			name: "  Original  ",
			operationId: "mcp:invalid-routine",
		};
		await expect(
			alice.mutation(api.routines.create, { ...input, exercises: [] }),
		).rejects.toMatchObject({ data: { code: "required", field: "exercises" } });
		expect(await alice.query(api.routines.list, {})).toEqual([]);

		const id = await alice.mutation(api.routines.create, input);
		expect(await alice.mutation(api.routines.create, input)).toBe(id);
		expect(await alice.query(api.routines.list, {})).toMatchObject([
			{ _id: id, name: "Original" },
		]);
	});

	it.each([
		{
			label: "an empty name",
			input: { ...valid, name: "" },
			expected: { code: "required", field: "name" },
		},
		{
			label: "a whitespace-only name",
			input: { ...valid, name: "  \t\n" },
			expected: { code: "required", field: "name" },
		},
		{
			label: "a name above the length limit",
			input: { ...valid, name: "a".repeat(MAX_ROUTINE_NAME_LENGTH + 1) },
			expected: { code: "routineNameTooLong", field: "name" },
		},
		{
			label: "an empty exercise list",
			input: { ...valid, exercises: [] },
			expected: { code: "required", field: "exercises" },
		},
		{
			label: "the same catalog exercise twice",
			input: { ...valid, exercises: [entry, { ...entry, defaultReps: 5 }] },
			expected: { code: "routineDuplicateExercise", field: "exercises" },
		},
		{
			label: "too many exercises",
			input: {
				...valid,
				exercises: SHIPPED_EXERCISES.slice(0, MAX_ROUTINE_EXERCISES + 1).map(
					({ _id }) => ({ ...entry, exerciseId: _id, defaultSets: 1 }),
				),
			},
			expected: { code: "routineTooLarge", field: "exercises" },
		},
		{
			label: "too many sets across distinct exercises",
			input: {
				...valid,
				exercises: SHIPPED_EXERCISES.slice(0, 6).map(({ _id }, index) => ({
					...entry,
					exerciseId: _id,
					defaultSets: index === 5 ? 1 : MAX_ROUTINE_TOTAL_SETS / 5,
				})),
			},
			expected: { code: "routineTooLarge", field: "exercises" },
		},
	])(
		"refuses $label on create and update without writing",
		async ({ input, expected }) => {
			const { alice } = setup();
			await expect(
				alice.mutation(api.routines.create, input),
			).rejects.toMatchObject({
				data: expected,
			});
			expect(await alice.query(api.routines.list, {})).toEqual([]);

			const id = await alice.mutation(api.routines.create, valid);
			const before = await alice.query(api.routines.list, {});
			await expect(
				alice.mutation(api.routines.update, { id, ...input }),
			).rejects.toMatchObject({
				data: expected,
			});
			expect(await alice.query(api.routines.list, {})).toEqual(before);
		},
	);

	it("refuses the same personal exercise twice on create and update", async () => {
		const { alice } = setup();
		const personalId = await alice.mutation(api.exercises.create, {
			name: "Landmine press",
			muscleGroups: ["shoulders"],
			category: "compound",
			equipment: "barbell",
		});
		const personalEntry = { ...entry, exerciseId: personalId };
		const input = { ...valid, exercises: [personalEntry, personalEntry] };
		const error = {
			data: { code: "routineDuplicateExercise", field: "exercises" },
		};
		await expect(
			alice.mutation(api.routines.create, input),
		).rejects.toMatchObject(error);
		expect(await alice.query(api.routines.list, {})).toEqual([]);

		const id = await alice.mutation(api.routines.create, valid);
		const before = await alice.query(api.routines.list, {});
		await expect(
			alice.mutation(api.routines.update, { id, ...input }),
		).rejects.toMatchObject(error);
		expect(await alice.query(api.routines.list, {})).toEqual(before);
	});

	it("accepts routines at the exact exercise and total-set limits and starts a session from them", async () => {
		const { alice } = setup();
		const atMaxSets = SHIPPED_EXERCISES.slice(0, 5).map((exercise) => ({
			exerciseId: exercise._id,
			defaultSets: MAX_ROUTINE_TOTAL_SETS / 5,
			defaultReps: 5,
		}));
		const routineId = await alice.mutation(api.routines.create, {
			name: "Max volume",
			exercises: atMaxSets,
		});
		const sessionId = await alice.mutation(api.routines.startSession, {
			routineId,
		});
		const session = await alice.query(api.workoutSessions.getById, {
			id: sessionId,
		});
		const totalPlannedSets = (session?.exercises ?? []).reduce(
			(sum, entry) => sum + entry.plannedSets.length,
			0,
		);
		expect(totalPlannedSets).toBe(MAX_ROUTINE_TOTAL_SETS);

		const atMaxExercises = SHIPPED_EXERCISES.slice(
			0,
			MAX_ROUTINE_EXERCISES,
		).map((exercise) => ({
			exerciseId: exercise._id,
			defaultSets: 1,
			defaultReps: 5,
		}));
		await alice.mutation(api.routines.update, {
			id: routineId,
			name: "Max exercises",
			exercises: atMaxExercises,
		});
		const [saved] = await alice.query(api.routines.list, {});
		expect(saved?.exercises).toHaveLength(MAX_ROUTINE_EXERCISES);
	});
});
