/// <reference types="vite/client" />
import { SHIPPED_EXERCISES } from "@workouts/core/exercises";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const shipped = SHIPPED_EXERCISES[0];
const setFields = {
	setNumber: 1,
	reps: 5,
	weight: 80,
	unit: "kg" as const,
	setType: "working" as const,
};

async function fixture() {
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) => {
		const { _id, _creationTime, ...fields } = shipped;
		const legacy = await ctx.db.insert("exercises", fields);
		const duplicate = await ctx.db.insert("exercises", fields);
		const personal = await ctx.db.insert("exercises", {
			...fields,
			isDefault: false,
			userId: "alice",
			notes: "Keep personal",
		});
		const session = await ctx.db.insert("workoutSessions", {
			userId: "alice",
			status: "active",
			startTime: 123,
			date: 123,
		});
		const sets = [];
		for (let i = 0; i < 7; i++)
			sets.push(
				await ctx.db.insert("sets", {
					...setFields,
					userId: "alice",
					sessionId: session,
					exerciseId: i === 6 ? personal : i % 2 ? legacy : duplicate,
					loggedAt: 123 + i,
					setNumber: i + 1,
				}),
			);
		const orm = await ctx.db.insert("oneRepMaxes", {
			userId: "alice",
			exerciseId: legacy,
			source: "manual",
			value: 123,
			unit: "kg",
			date: 234,
		});
		const routine = await ctx.db.insert("routines", {
			userId: "alice",
			name: "Keep routine",
			exercises: [
				{
					exerciseId: legacy,
					defaultSets: 3,
					defaultReps: 8,
					defaultWeight: 50,
				},
				{ exerciseId: personal, defaultSets: 2, defaultReps: 5 },
			],
		});
		const hosted = await ctx.db.insert("hostedWorkouts", {
			hostUserId: "alice",
			title: "Keep template",
			status: "closed",
			createdAt: 123,
			joinToken: "migration-test",
			hostParticipation: "hostOnly",
			template: {
				strengthBlocks: [
					{
						blockId: "a",
						exerciseId: duplicate,
						exerciseName: "Snapshot name",
						instructions: "Snapshot instructions",
						defaultSets: 4,
					},
					{ blockId: "b", exerciseName: "Unlinked block" },
					{
						blockId: "c",
						exerciseId: personal,
						exerciseName: "Personal block",
					},
				],
				wodBlocks: [],
			},
		});
		return { legacy, duplicate, personal, session, sets, orm, routine, hosted };
	});
	const snapshot = () =>
		t.run(async (ctx) => ({
			sets: await ctx.db.query("sets").collect(),
			orms: await ctx.db.query("oneRepMaxes").collect(),
			routines: await ctx.db.query("routines").collect(),
			hosted: await ctx.db.query("hostedWorkouts").collect(),
			exercises: await ctx.db.query("exercises").collect(),
		}));
	return { t, ids, snapshot, alice: t.withIdentity({ subject: "alice" }) };
}

async function finish(t: Awaited<ReturnType<typeof fixture>>["t"]) {
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	return t.query(internal.exerciseMigration.status, {});
}

describe("migration to shipped exercise references", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("dry-runs without changing any training or exercise documents", async () => {
		const { t, snapshot } = await fixture();
		const before = await snapshot();
		await t.mutation(internal.exerciseMigration.start, {
			dryRun: true,
			batchSize: 2,
		});
		const result = await finish(t);
		expect(result).toMatchObject({
			phase: "complete",
			dryRun: true,
			changed: { sets: 6, oneRepMaxes: 1, routines: 1, hostedWorkouts: 1 },
		});
		expect(await snapshot()).toEqual(before);
	});

	it("rewrites every reference in batches and preserves all other values and record IDs", async () => {
		const { t, ids, snapshot, alice } = await fixture();
		const before = await snapshot();
		await t.mutation(internal.exerciseMigration.start, {
			dryRun: true,
			batchSize: 2,
		});
		await finish(t);
		const migrationId = await t.mutation(internal.exerciseMigration.start, {
			dryRun: false,
			batchSize: 2,
		});
		const result = await finish(t);
		expect(result).toMatchObject({
			phase: "complete",
			dryRun: false,
			changed: {
				sets: 6,
				oneRepMaxes: 1,
				routines: 1,
				hostedWorkouts: 1,
				"verify:sets": 0,
				"verify:oneRepMaxes": 0,
				"verify:routines": 0,
				"verify:hostedWorkouts": 0,
			},
		});
		const after = await snapshot();
		const mapId = (id: string) =>
			id === ids.legacy || id === ids.duplicate ? shipped._id : id;
		expect(after.sets).toEqual(
			before.sets.map((set) => ({ ...set, exerciseId: mapId(set.exerciseId) })),
		);
		expect(after.orms).toEqual(
			before.orms.map((orm) => ({ ...orm, exerciseId: mapId(orm.exerciseId) })),
		);
		expect(after.routines).toEqual(
			before.routines.map((routine) => ({
				...routine,
				exercises: routine.exercises.map((exercise) => ({
					...exercise,
					exerciseId: mapId(exercise.exerciseId),
				})),
			})),
		);
		expect(after.hosted).toEqual(
			before.hosted.map((hosted) => ({
				...hosted,
				template: {
					...hosted.template,
					strengthBlocks: hosted.template.strengthBlocks.map((block) =>
						block.exerciseId
							? { ...block, exerciseId: mapId(block.exerciseId) }
							: block,
					),
				},
			})),
		);
		expect(
			after.exercises.find((exercise) => exercise._id === ids.personal),
		).toEqual(
			before.exercises.find((exercise) => exercise._id === ids.personal),
		);
		expect(
			after.exercises.find((exercise) => exercise._id === ids.legacy)
				?.shippedExerciseId,
		).toBe(shipped._id);
		expect(
			await alice.query(api.exercises.getHistory, { exerciseId: shipped._id }),
		).toHaveLength(6);
		expect(
			await alice.query(api.exercises.getHistory, { exerciseId: ids.legacy }),
		).toHaveLength(6);
		expect(
			await t.mutation(internal.exerciseMigration.start, { dryRun: false }),
		).toBe(migrationId);
		await t.mutation(internal.exerciseMigration.resume, {});
		expect(await snapshot()).toEqual(after);
	});

	it("resumes a saved cursor and handles old-client writes during and after the migration", async () => {
		const { t, ids, alice } = await fixture();
		await t.mutation(internal.exerciseMigration.start, {
			dryRun: false,
			batchSize: 2,
		});
		let state = await t.query(internal.exerciseMigration.status, {});
		while (state?.phase === "defaults") {
			await t.mutation(internal.exerciseMigration.step, {
				generation: state.generation,
			});
			state = await t.query(internal.exerciseMigration.status, {});
		}
		if (!state) throw new Error("No migration checkpoint");
		await t.mutation(internal.exerciseMigration.step, {
			generation: state.generation,
		});
		state = await t.query(internal.exerciseMigration.status, {});
		expect(state?.cursor).not.toBeNull();
		expect(
			await alice.query(api.exercises.getHistory, { exerciseId: shipped._id }),
		).toHaveLength(6);
		const setId = await alice.mutation(api.sets.add, {
			...setFields,
			sessionId: ids.session,
			exerciseId: ids.legacy,
		});
		expect(await t.run((ctx) => ctx.db.get(setId))).toMatchObject({
			exerciseId: shipped._id,
		});
		await alice.mutation(api.sets.duplicate, { id: ids.sets[5] });
		await t.mutation(internal.exerciseMigration.resume, {});
		expect(await finish(t)).toMatchObject({ phase: "complete" });
		expect(
			await alice.query(api.exercises.getHistory, { exerciseId: shipped._id }),
		).toHaveLength(8);
		expect(
			await alice.query(api.oneRepMaxes.getCurrentForExercise, {
				exerciseId: shipped._id,
			}),
		).toMatchObject({ source: "manual", value: 123, exerciseId: shipped._id });
		const newer = await alice.mutation(api.sets.add, {
			...setFields,
			sessionId: ids.session,
			exerciseId: ids.legacy,
		});
		expect(await t.run((ctx) => ctx.db.get(newer))).toMatchObject({
			exerciseId: shipped._id,
		});
	});

	it("blocks on an unmapped default instead of guessing or altering history", async () => {
		const { t, snapshot } = await fixture();
		await t.run(async (ctx) => {
			const { _id, _creationTime, ...fields } = shipped;
			await ctx.db.insert("exercises", {
				...fields,
				name: "Unrecognized old exercise",
			});
		});
		const before = await snapshot();
		await t.mutation(internal.exerciseMigration.start, {
			dryRun: false,
			batchSize: 2,
		});
		expect(await finish(t)).toMatchObject({
			phase: "blocked",
			error: expect.stringContaining("Unrecognized old exercise"),
		});
		expect(await snapshot()).toEqual(before);
	});

	it("completes on an empty database without creating defaults", async () => {
		const t = convexTest(schema, modules);
		await t.mutation(internal.exerciseMigration.start, {
			dryRun: false,
			batchSize: 1,
		});
		expect(await finish(t)).toMatchObject({ phase: "complete", mappings: {} });
		expect(await t.run((ctx) => ctx.db.query("exercises").collect())).toEqual(
			[],
		);
	});
});
