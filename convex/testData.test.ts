/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
afterEach(() => {
	vi.unstubAllEnvs();
	vi.useRealTimers();
});

describe("in-app test data", () => {
	it("blocks both actions during an Activity or shared-event involvement without deleting history", async () => {
		vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "https://test.clerk.accounts.dev");
		vi.stubEnv("CONVEX_CLOUD_URL", "https://test-dev.convex.cloud");
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(api.routines.create, {
			name: "Keep me",
			exercises: [],
		});
		const session = await alice.mutation(api.workoutSessions.create, {});
		for (const mode of ["load", "clear"] as const)
			await expect(
				alice.mutation(api.testData.reset, { mode, today: "2026-10-10", expectedSubject: "alice" }),
			).rejects.toThrow("activeActivity");
		expect((await alice.query(api.testData.availability, {})).blocker).toBe(
			"activeActivity",
		);
		await alice.mutation(api.workoutSessions.cancel, { id: session });
		await alice.mutation(api.hostedWorkouts.createDraft, {
			title: "Shared",
			hostParticipation: "hostOnly",
			template: {
				strengthBlocks: [{ blockId: "press", exerciseName: "Press" }],
				wodBlocks: [],
			},
		});
		for (const mode of ["load", "clear"] as const)
			await expect(
				alice.mutation(api.testData.reset, { mode, today: "2026-10-10", expectedSubject: "alice" }),
			).rejects.toThrow("hostedWorkout");
		expect((await alice.query(api.testData.availability, {})).blocker).toBe(
			"hostedWorkout",
		);
		expect(await alice.query(api.routines.list, {})).toMatchObject([
			{ name: "Keep me" },
		]);
		expect(await alice.query(api.hostedWorkouts.listMine, {})).toHaveLength(1);
	});
	it("protects a participant's linked history and the host's shared event", async () => {
		vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "https://test.clerk.accounts.dev");
		vi.stubEnv("CONVEX_CLOUD_URL", "https://test-preview.convex.cloud");
		const t = convexTest(schema, modules);
		const host = t.withIdentity({ subject: "host" });
		const participant = t.withIdentity({ subject: "participant" });
		const id = await host.mutation(api.hostedWorkouts.createDraft, { title: "Shared event", hostParticipation: "hostOnly", template: { strengthBlocks: [{ blockId: "press", exerciseName: "Press" }], wodBlocks: [] } });
		await host.mutation(api.hostedWorkouts.open, { id });
		const event = await host.query(api.hostedWorkouts.getMine, { id });
		const sessionId = await participant.mutation(api.hostedWorkoutParticipants.join, { token: event!.hosted.joinToken });
		await participant.mutation(api.workoutSessions.cancel, { id: sessionId });
		const before = await host.query(api.hostedWorkouts.getMine, { id });
		for (const mode of ["load", "clear"] as const) await expect(participant.mutation(api.testData.reset, { mode, today: "2026-10-10", expectedSubject: "participant" })).rejects.toThrow("hostedWorkout");
		expect(await host.query(api.hostedWorkouts.getMine, { id })).toEqual(before);
		expect(await participant.query(api.workoutSessions.getById, { id: sessionId })).toMatchObject({ status: "cancelled" });
	});
	it("loads recent training and nutrition edge cases and clears their account records", async () => {
		vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "https://test.clerk.accounts.dev");
		vi.stubEnv("CONVEX_CLOUD_URL", "https://test-local.convex.cloud");
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-10-09T22:30:00Z"));
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(api.testData.reset, {
			mode: "load",
			today: "2026-10-10", expectedSubject: "alice",
		});
		const history = await alice.query(api.activities.list, { limit: 100 });
		expect(new Set(history.items.map((item) => item.sport))).toEqual(
			new Set(["strength", "running", "cycling"]),
		);
		expect(await alice.query(api.bodyMetrics.list, {})).toHaveLength(3);
		const library = await alice.query(api.nutritionLibrary.browse, {
			query: "",
			paginationOpts: { cursor: null, numItems: 50 },
		});
		expect(
			library.page.filter((record) => record.kind === "food"),
		).toHaveLength(3);
		expect(
			library.page.filter((record) => record.kind === "combo"),
		).toHaveLength(1);
		const routine = (await alice.query(api.routines.list, {})).find(
			(routine) => routine.name === "Test: Strength A",
		)!;
		const references = await alice.query(api.oneRepMaxes.getReferences, {
			exerciseId: routine.exercises[0].exerciseId,
		});
		expect(references).toMatchObject({
			measured: { source: "actual", value: 60 },
			estimated: { source: "calculated" },
			manual: { source: "manual", value: 75 },
		});
		const foods = library.page
			.filter((record) => record.kind === "food")
			.map((record) => JSON.parse(record.payload!));
		expect(
			foods.find((food) => food.id === "test-oats").nutrients.energy,
		).toEqual({ kind: "value", amount: 250 });
		expect(
			foods.find((food) => food.id === "test-fork").provenance.forkedFrom,
		).toBe("shipped:potatoes-raw");
		const today = await alice.query(api.nutritionDiary.day, {
			date: "2026-10-10",
		});
		expect(today.entries[0].nutrients).toMatchObject({
			energy: { kind: "value", amount: 200 },
			fibre: { kind: "absent" },
			saturatedFat: { kind: "value", amount: 0 },
		});
		const past = await alice.query(api.nutritionDiary.day, {
			date: "2026-10-08",
		});
		expect(past.entries.some((entry) => entry.estimated)).toBe(true);
		expect(
			past.entries.some(
				(entry) =>
					entry.provenance.source === "personal" &&
					entry.provenance.sourceId === "test-removed-food",
			),
		).toBe(true);
		const order = [
			"protein",
			"energy",
			"carbs",
			"fat",
			"saturatedFat",
			"fibre",
			"sugars",
			"salt",
		] as const;
		await alice.mutation(api.nutritionGoals.setDisplayOrder, {
			displayOrder: [...order],
		});
		expect(today.entries.length).toBeGreaterThan(0);
		expect(
			(await alice.query(api.nutritionDiary.day, { date: "2026-10-09" }))
				.entries,
		).toEqual([]);
		expect(
			(await alice.query(api.nutritionGoals.forDate, { date: "2026-09-25" }))
				.goals,
		).toContainEqual({ nutrient: "protein", direction: "min", target: 100 });
		expect(
			(await alice.query(api.nutritionGoals.forDate, { date: "2026-10-10" }))
				.goals,
		).toContainEqual({ nutrient: "protein", direction: "min", target: 130 });
		expect(
			(
				await alice.query(api.nutritionDrafts.list, {
					startDate: "2026-10-01",
					endDate: "2026-10-10",
					paginationOpts: { cursor: null, numItems: 50 },
				})
			).page,
		).toHaveLength(1);
		await alice.mutation(api.routines.create, { name: "Added after load", exercises: [] });
		await alice.mutation(api.nutritionDiary.log, {
			date: "2026-10-09", meal: "snacks", name: { en: "Manual snack", nl: "Handmatige snack" }, serving: { en: "Serving", nl: "Portie" }, quantity: 1, amount: 100, baseUnit: "g", nutrients: today.entries[0].nutrients, provenance: { source: "oneOff" },
		});
		expect((await alice.query(api.nutritionDiary.day, { date: "2026-10-09" })).entries).toHaveLength(1);
		await alice.mutation(api.testData.reset, {
			mode: "clear",
			today: "2026-10-10", expectedSubject: "alice",
		});
		expect((await alice.query(api.activities.list, {})).items).toEqual([]);
		expect(await alice.query(api.routines.list, {})).toEqual([]);
		expect((await alice.query(api.nutritionDiary.day, { date: "2026-10-09" })).entries).toEqual([]);
		expect(await alice.query(api.bodyMetrics.list, {})).toEqual([]);
		expect(
			(
				await alice.query(api.nutritionLibrary.browse, {
					query: "",
					paginationOpts: { cursor: null, numItems: 50 },
				})
			).page,
		).toEqual([]);
		expect(
			(await alice.query(api.nutritionDiary.day, { date: "2026-10-10" }))
				.entries,
		).toEqual([]);
		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2026-10-10" }),
		).toMatchObject({ goals: [], displayOrder: [...order] });
		expect(
			(
				await alice.query(api.nutritionDrafts.list, {
					startDate: "2026-10-01",
					endDate: "2026-10-10",
					paginationOpts: { cursor: null, numItems: 50 },
				})
			).page,
		).toEqual([]);
	});
	it("replaces personal training without duplicates and clears manual records only for the signed-in account", async () => {
		vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "https://test.clerk.accounts.dev");
		vi.stubEnv("CONVEX_CLOUD_URL", "https://test-dev.convex.cloud");
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		await bob.mutation(api.routines.create, {
			name: "Bob's routine",
			exercises: [],
		});
		await alice.mutation(api.routines.create, {
			name: "Manual routine",
			exercises: [],
		});
		for (let i = 0; i < 2; i++) {
			await alice.mutation(api.testData.reset, {
				mode: "load",
				today: "2026-10-10", expectedSubject: "alice",
			});
			expect(await alice.query(api.routines.list, {})).toHaveLength(2);
			expect(
				await alice.query(api.workoutSessions.listRecent, { limit: 100 }),
			).toHaveLength(6);
		}
		await alice.mutation(api.testData.reset, {
			mode: "clear",
			today: "2026-10-10", expectedSubject: "alice",
		});
		expect(await alice.query(api.routines.list, {})).toEqual([]);
		expect(await alice.query(api.workoutSessions.listRecent, {})).toEqual([]);
		expect(await bob.query(api.routines.list, {})).toMatchObject([
			{ name: "Bob's routine" },
		]);
	});
	it("rejects unauthenticated and production resets at the public boundary", async () => {
		vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "https://test.clerk.accounts.dev");
		vi.stubEnv("CONVEX_CLOUD_URL", "https://test-preview.convex.cloud");
		const t = convexTest(schema, modules);
		await expect(
			t.mutation(api.testData.reset, {
				mode: "clear",
				today: "2026-10-10", expectedSubject: "alice",
			}),
		).rejects.toThrow("unauthenticated");
		const alice = t.withIdentity({ subject: "alice" });
		await expect(
			alice.mutation(api.testData.reset, {
				mode: "clear",
				today: "2026-10-10", expectedSubject: "bob",
			}),
		).rejects.toThrow("accountChanged");
		expect(await alice.query(api.testData.availability, {})).toEqual({
			available: true,
			blocker: null,
		});
		vi.stubEnv(
			"CONVEX_CLOUD_URL",
			"https://fine-akita-444.eu-west-1.convex.cloud",
		);
		expect(await alice.query(api.testData.availability, {})).toEqual({
			available: false,
			blocker: null,
		});
		for (const mode of ["load", "clear"] as const) {
			await expect(
				alice.mutation(api.testData.reset, { mode, today: "2026-10-10", expectedSubject: "alice" }),
			).rejects.toThrow("unavailable");
		}
	});
});
