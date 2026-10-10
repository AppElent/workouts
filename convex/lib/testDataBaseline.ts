import { normalizePersonalFood, personalFoodSnapshot } from "@workouts/core";
import { SHIPPED_EXERCISES } from "@workouts/core/exercises";
import type { MutationCtx } from "../_generated/server";
import { libraryIndexFields } from "./nutritionLibraryIndex";
import {
	performanceReference,
	recalcStrengthReferences,
} from "./strengthReferences";

const DAY = 86_400_000;

export async function loadTestDataBaseline(ctx: MutationCtx, userId: string, today: string) {
	const now = Date.now();
	const at = (daysAgo: number) => now - daysAgo * DAY;
	const date = (daysAgo: number) =>
		new Date(Date.parse(today) - daysAgo * DAY).toISOString().slice(0, 10);
	const exercise = SHIPPED_EXERCISES.find(
		(item) => item.equipment === "barbell",
	);
	if (!exercise) throw new Error("Shipped barbell exercise unavailable");
	const personalId = await ctx.db.insert("exercises", {
		userId,
		name: "Test: Paused press",
		muscleGroups: ["chest"],
		category: "compound",
		equipment: "barbell",
		isDefault: false,
	});
	const exercises = [exercise._id, personalId].map((exerciseId) => ({
		exerciseId,
		defaultSets: 3,
		defaultReps: 5,
		defaultWeight: 60,
	}));
	const routineId = await ctx.db.insert("routines", {
		userId,
		name: "Test: Strength A",
		exercises,
	});
	await ctx.db.insert("routines", {
		userId,
		name: "Test: Strength B",
		exercises: exercises.slice(1),
	});
	for (const daysAgo of [0, 3, 7, 10, 14, 20]) {
		const sessionId = await ctx.db.insert("workoutSessions", {
			userId,
			routineId,
			name: "Test: Strength",
			date: at(daysAgo),
			startTime: at(daysAgo) - 3_600_000,
			endTime: at(daysAgo),
			status: "completed",
			exercises: exercises.map((item) => ({
				exerciseId: item.exerciseId,
				plannedSets: [{ reps: 5, weight: 60, unit: "kg" }],
			})),
		});
		for (const [index, setType] of (
			["warmup", "working", "drop", "failure"] as const
		).entries()) {
			const set = {
				userId,
				sessionId,
				exerciseId: exercise._id,
				setNumber: index + 1,
				reps: index === 1 && daysAgo === 0 ? 1 : 5,
				weight: index === 0 ? 20 : 60,
				unit: "kg" as const,
				setType,
				loggedAt: at(daysAgo),
				performanceVerified: true,
			};
			await ctx.db.insert("sets", {
				...set,
				...(await performanceReference(ctx, userId, set)),
			});
		}
	}
	await recalcStrengthReferences(ctx, userId, exercise._id);
	await ctx.db.insert("oneRepMaxes", {
		userId,
		exerciseId: exercise._id,
		value: 75,
		unit: "kg",
		date: at(1),
		source: "manual",
	});
	for (const [index, sport] of (["running", "cycling"] as const).entries()) {
		const activityId = await ctx.db.insert("activities", {
			userId,
			clientEntryId: `test-${sport}`,
			sport,
			occurredAt: at(2 + index * 3),
			durationSeconds: 1800 + index * 1800,
			title: sport === "running" ? "Test: Easy run" : "Test: Weekend ride",
			createdAt: now,
			updatedAt: now,
		});
		await ctx.db.insert("enduranceActivityDetails", {
			userId,
			activityId,
			distanceMeters: index === 0 ? 5000 : 25000,
			environment: "outdoor",
			effort: 5,
		});
	}
	for (const daysAgo of [0, 10, 20])
		await ctx.db.insert("bodyMetrics", {
			userId,
			date: at(daysAgo),
			weight: 75 + daysAgo / 20,
			unit: "kg",
			bodyFatPct: 18,
		});

	const nutrients = {
		energy: { kind: "value", amount: 200 },
		protein: { kind: "value", amount: 12 },
		carbs: { kind: "value", amount: 25 },
		fat: { kind: "value", amount: 6 },
		saturatedFat: { kind: "value", amount: 0 },
		fibre: { kind: "absent" },
		sugars: { kind: "trace" },
		salt: { kind: "value", amount: 0.2 },
	} as const;
	const food = normalizePersonalFood({
		id: "test-oats",
		name: { en: "Test: Breakfast oats", nl: "Test: Ontbijthavermout" },
		baseUnit: "g",
		nutrients,
		servings: [
			{ label: { en: "Small bowl", nl: "Kleine kom" }, amount: 50 },
			{ label: { en: "Large bowl", nl: "Grote kom" }, amount: 100 },
		],
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: false,
		},
		createdAt: now,
		updatedAt: now,
	});
	const soup = normalizePersonalFood({
		...food,
		id: "test-soup",
		name: { en: "Test: Estimated soup", nl: "Test: Geschatte soep" },
		classification: "recipe",
		estimated: true,
		baseUnit: "serving",
		nutritionBasis: { kind: "perServing", label: { en: "Bowl", nl: "Kom" } },
		servings: [],
	});
	const shipped = {
		id: "shipped:potatoes-raw" as const,
		name: { en: "Potatoes raw", nl: "Aardappelen rauw" },
	};
	const fork = normalizePersonalFood({
		...food,
		id: "test-fork",
		name: { en: `Test: ${shipped.name.en}`, nl: `Test: ${shipped.name.nl}` },
		provenance: {
			...food.provenance,
			forkedFrom: shipped.id,
			locallyEdited: true,
		},
	});
	const snapshot = personalFoodSnapshot(food, { quantity: 1 });
	const combo = {
		id: "test-breakfast",
		name: "Test: Breakfast / Ontbijt",
		createdAt: now,
		updatedAt: now,
		parts: [
			{
				id: "oats",
				reference: { kind: "personal", foodId: food.id },
				snapshot,
			},
		],
	};
	for (const item of [food, soup, fork, combo]) {
		const recordKind = item === combo ? "combo" : "food";
		// The current source differs from the historical snapshot deliberately.
		const payload = JSON.stringify(
			item === food
				? {
						...food,
						nutrients: {
							...food.nutrients,
							energy: { kind: "value", amount: 250 },
						},
					}
				: item,
		);
		await ctx.db.insert("nutritionLibraryRecords", {
			userId,
			recordId: item.id,
			recordKind,
			payload,
			schemaVersion: 2,
			revision: 1,
			deleted: false,
			updatedAt: now,
			...libraryIndexFields(recordKind, payload),
		});
	}
	for (const daysAgo of [0, 2, 3, 7, 10, 14, 20]) {
		await ctx.db.insert("nutritionDiaryEntries", {
			userId,
			...snapshot,
			clientEntryId: `test-breakfast-${daysAgo}`,
			date: date(daysAgo),
			meal: "breakfast",
			loggedAt: at(daysAgo),
			comboGroup: {
				id: `test-group-${daysAgo}`,
				comboId: combo.id,
				name: combo.name,
			},
		});
		if (daysAgo > 0)
			await ctx.db.insert("nutritionDiaryEntries", {
				userId,
				...personalFoodSnapshot(soup, { quantity: 1 }),
				clientEntryId: `test-soup-${daysAgo}`,
				date: date(daysAgo),
				meal: "dinner",
				loggedAt: at(daysAgo),
			});
	}
	await ctx.db.insert("nutritionDiaryEntries", {
		userId,
		...snapshot,
		clientEntryId: "test-unavailable",
		name: {
			en: "Test: Unavailable food",
			nl: "Test: Niet beschikbaar voedingsmiddel",
		},
		provenance: {
			source: "personal",
			sourceId: "test-removed-food",
			nutritionSource: "manual",
			locallyEdited: false,
		},
		date: date(2),
		meal: "lunch",
		loggedAt: at(2),
	});
	for (const [daysAgo, target] of [
		[21, 100],
		[5, 130],
	])
		await ctx.db.insert("nutritionGoalVersions", {
			userId,
			effectiveFrom: date(daysAgo),
			goals: [{ nutrient: "protein", direction: "min", target }],
			...(daysAgo === 21 ? { referenceGoals: [] } : {}),
		});
	await ctx.db.insert("nutritionCaptureDrafts", {
		userId,
		recordId: "test-capture",
		date: date(0),
		meal: "lunch",
		note: "Test: Sandwich and an apple / Boterham en een appel",
		deleted: false,
		createdAt: now,
		updatedAt: now,
	});
	await ctx.db.insert("nutritionCaptureDraftCounts", {
		userId,
		date: date(0),
		count: 1,
	});
}
