import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
	captureDraft,
	diarySnapshotFields,
	enduranceEnvironment,
	enduranceSport,
	equipment,
	exerciseCategory,
	exerciseReference,
	hostedLevel,
	libraryCategory,
	libraryRecordKind,
	librarySchemaVersion,
	loadUnit,
	mealSlot,
	measuredUnit,
	nutrientKey,
	nutritionGoal,
	oneRepMaxSource,
	plannedSet,
	rxScaled,
	setReferenceSource,
	setType,
	strengthReferenceSnapshots,
	wodMovement,
	wodScoreFields,
	wodType,
} from "./lib/validators";

export default defineSchema({
	nutritionGoalVersions: defineTable({
		userId: v.string(),
		effectiveFrom: v.string(),
		// One complete goal set per version, an empty set included, so replacing
		// one effective date is atomic and every other date stays as it was.
		goals: v.array(nutritionGoal),
		// Only on the first version: the legacy goals frozen so dates before it
		// keep their goals.
		referenceGoals: v.optional(v.array(nutritionGoal)),
	})
		.index("by_user_effectiveFrom", ["userId", "effectiveFrom"])
		.index("by_user", ["userId"]),

	nutritionGoalPreferences: defineTable({
		userId: v.string(),
		displayOrder: v.array(nutrientKey),
	}).index("by_user", ["userId"]),

	nutritionLibraryRecords: defineTable({
		userId: v.string(),
		recordId: v.string(),
		recordKind: libraryRecordKind,
		// Opaque validated JSON, so device-minted ids survive unchanged.
		payload: v.optional(v.string()),
		// Kept on tombstones so an older client cannot restore a reduced shape.
		schemaVersion: v.optional(librarySchemaVersion),
		revision: v.number(),
		deleted: v.boolean(),
		updatedAt: v.number(),
		name: v.optional(v.string()),
		searchText: v.optional(v.string()),
		category: v.optional(libraryCategory),
		barcode: v.optional(v.string()),
		forkedFrom: v.optional(v.string()),
	})
		.index("by_user_and_record", ["userId", "recordId"])
		.index("by_user_deleted_name", ["userId", "deleted", "name"])
		.index("by_user_deleted_category_name", [
			"userId",
			"deleted",
			"category",
			"name",
		])
		.index("by_user_barcode", ["userId", "barcode", "deleted"])
		.index("by_user_fork", ["userId", "forkedFrom", "deleted"])
		.searchIndex("search_library", {
			searchField: "searchText",
			filterFields: ["userId", "deleted", "category"],
		}),

	nutritionLibraryOperationReceipts: defineTable({
		userId: v.string(),
		operationId: v.string(),
		payload: v.string(),
		result: v.string(),
		createdAt: v.number(),
	}).index("by_user_and_operation", ["userId", "operationId"]),

	nutritionFoodPhotos: defineTable({
		userId: v.string(),
		storageId: v.id("_storage"),
	})
		.index("by_storage", ["storageId"])
		.index("by_user", ["userId"]),

	nutritionCaptureDrafts: defineTable({
		userId: v.string(),
		recordId: v.string(),
		date: v.string(),
		meal: mealSlot,
		note: v.string(),
		deleted: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_user_and_record", ["userId", "recordId"])
		.index("by_user_and_deleted_and_date", ["userId", "deleted", "date"]),

	nutritionCaptureDraftCounts: defineTable({
		userId: v.string(),
		date: v.string(),
		count: v.number(),
	}).index("by_user_and_date", ["userId", "date"]),

	nutritionCaptureDraftReceipts: defineTable({
		userId: v.string(),
		operationId: v.string(),
		payload: v.string(),
		result: v.union(captureDraft, v.null()),
	}).index("by_user_and_operation", ["userId", "operationId"]),

	// Analyses per account per UTC day; bookkeeping only, no personal content.
	nutritionAiUsage: defineTable({
		userId: v.string(),
		day: v.string(),
		count: v.number(),
		// Candidate selections still allowed: one per analysis.
		choices: v.optional(v.number()),
	}).index("by_user_and_day", ["userId", "day"]),

	personalMeasures: defineTable({
		userId: v.string(),
		name: v.string(),
		normalizedName: v.string(),
		amount: v.number(),
		unit: measuredUnit,
		order: v.number(),
	})
		.index("by_user_and_order", ["userId", "order"])
		.index("by_user_and_normalized_name", ["userId", "normalizedName"]),

	supplementaryServings: defineTable({
		userId: v.string(),
		foodId: v.string(),
		name: v.string(),
		normalizedName: v.string(),
		amount: v.number(),
		unit: measuredUnit,
	})
		.index("by_userId_and_foodId", ["userId", "foodId"])
		.index("by_userId_and_foodId_and_normalizedName", [
			"userId",
			"foodId",
			"normalizedName",
		]),

	nutritionDiaryEntries: defineTable({
		userId: v.string(),
		...diarySnapshotFields,
		loggedAt: v.number(),
	})
		.index("by_user", ["userId"])
		.index("by_user_date", ["userId", "date"])
		.index("by_user_combo_group", ["userId", "comboGroup.id"])
		.index("by_user_client_entry", ["userId", "clientEntryId"]),

	nutritionDiaryOperationReceipts: defineTable({
		userId: v.string(),
		operationId: v.string(),
		payload: v.string(),
		result: v.string(),
		createdAt: v.number(),
	}).index("by_user_and_operation", ["userId", "operationId"]),

	nutritionDiaryDayVersions: defineTable({
		userId: v.string(),
		date: v.string(),
		revision: v.number(),
	}).index("by_user_date", ["userId", "date"]),

	nutritionGoals: defineTable({
		userId: v.string(),
		...nutritionGoal.fields,
	}).index("by_user", ["userId"]),

	exercises: defineTable({
		name: v.string(),
		muscleGroups: v.array(v.string()),
		category: exerciseCategory,
		equipment,
		notes: v.optional(v.string()),
		instructions: v.optional(v.array(v.string())),
		weightIncrement: v.optional(v.number()),
		// New rows are personal. `isDefault` rows without a `userId` are retained
		// copies of the catalog that used to be seeded; `shippedExerciseId` names
		// their shipped exercise.
		isDefault: v.boolean(),
		shippedExerciseId: v.optional(v.string()),
		userId: v.optional(v.string()),
	}).index("by_user", ["userId"]),

	workoutSessions: defineTable({
		userId: v.string(),
		date: v.number(),
		startTime: v.number(),
		endTime: v.optional(v.number()),
		name: v.optional(v.string()),
		routineId: v.optional(v.id("routines")),
		// Absent on legacy sessions: their recorded history is not reclassified.
		exercises: v.optional(
			v.array(
				v.object({
					exerciseId: exerciseReference,
					references: v.optional(strengthReferenceSnapshots),
					plannedSets: v.array(plannedSet),
				}),
			),
		),
		status: v.union(
			v.literal("active"),
			v.literal("completed"),
			v.literal("cancelled"),
		),
	})
		.index("by_user", ["userId"])
		.index("by_user_status", ["userId", "status"])
		.index("by_user_status_date", ["userId", "status", "date"])
		.index("by_user_date", ["userId", "date"]),

	activities: defineTable({
		userId: v.string(),
		clientEntryId: v.string(),
		sport: enduranceSport,
		occurredAt: v.number(),
		durationSeconds: v.number(),
		title: v.optional(v.string()),
		notes: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_user_client_entry", ["userId", "clientEntryId"])
		.index("by_user_occurred_at", ["userId", "occurredAt"])
		.index("by_user_sport_occurred_at", ["userId", "sport", "occurredAt"]),

	enduranceActivityDetails: defineTable({
		activityId: v.id("activities"),
		userId: v.string(),
		distanceMeters: v.number(),
		environment: v.optional(enduranceEnvironment),
		elevationGainMeters: v.optional(v.number()),
		averageHeartRate: v.optional(v.number()),
		effort: v.optional(v.number()),
	})
		.index("by_activity", ["activityId"])
		.index("by_user", ["userId"]),

	sets: defineTable({
		userId: v.string(),
		sessionId: v.id("workoutSessions"),
		exerciseId: exerciseReference,
		setNumber: v.number(),
		reps: v.number(),
		weight: v.number(),
		unit: loadUnit,
		rpe: v.optional(v.number()),
		setType,
		loggedAt: v.number(),
		// Compatibility with the earlier issue 89 development schema; no new writes.
		estimatedMax: v.optional(v.number()),
		performanceVerified: v.optional(v.boolean()),
		referenceKind: v.optional(setReferenceSource),
		referenceValueKg: v.optional(v.number()),
	})
		.index("by_session", ["sessionId"])
		.index("by_user", ["userId"])
		.index("by_user_exercise", ["userId", "exerciseId"])
		.index("by_user_exercise_logged_at", ["userId", "exerciseId", "loggedAt"])
		.index("by_strength_reference", [
			"userId",
			"exerciseId",
			"referenceKind",
			"referenceValueKg",
		]),

	strengthLogReceipts: defineTable({
		userId: v.string(),
		operationId: v.string(),
		payload: v.string(),
		setId: v.id("sets"),
	}).index("by_user_and_operation", ["userId", "operationId"]),

	oneRepMaxes: defineTable({
		userId: v.string(),
		exerciseId: exerciseReference,
		value: v.number(),
		unit: loadUnit,
		date: v.number(),
		source: oneRepMaxSource,
		formula: v.optional(v.string()),
		sourceSetId: v.optional(v.id("sets")),
	})
		.index("by_user", ["userId"])
		.index("by_user_exercise", ["userId", "exerciseId"]),

	bodyMetrics: defineTable({
		userId: v.string(),
		date: v.number(),
		weight: v.optional(v.number()),
		unit: loadUnit,
		bodyFatPct: v.optional(v.number()),
		measurements: v.optional(
			v.object({
				chest: v.optional(v.number()),
				waist: v.optional(v.number()),
				arms: v.optional(v.number()),
				thighs: v.optional(v.number()),
			}),
		),
		notes: v.optional(v.string()),
	})
		.index("by_user", ["userId"])
		.index("by_user_date", ["userId", "date"]),

	routines: defineTable({
		userId: v.string(),
		name: v.string(),
		exercises: v.array(
			v.object({
				exerciseId: exerciseReference,
				defaultSets: v.number(),
				defaultReps: v.number(),
				defaultWeight: v.optional(v.number()),
			}),
		),
	}).index("by_user", ["userId"]),

	wods: defineTable({
		// Absent on the benchmark catalog (`isDefault`), which the seed owns.
		userId: v.optional(v.string()),
		name: v.string(),
		type: wodType,
		description: v.optional(v.string()),
		repScheme: v.optional(v.string()),
		timeCapSeconds: v.optional(v.number()),
		durationSeconds: v.optional(v.number()),
		movements: v.array(wodMovement),
		isDefault: v.boolean(),
	})
		.index("by_user", ["userId"])
		.index("by_default", ["isDefault"])
		.index("by_name", ["name"]),

	wodResults: defineTable({
		userId: v.string(),
		wodId: v.id("wods"),
		sessionId: v.optional(v.id("workoutSessions")),
		date: v.number(),
		rxScaled,
		...wodScoreFields,
	})
		.index("by_user", ["userId"])
		.index("by_user_wod", ["userId", "wodId"])
		.index("by_session", ["sessionId"]),

	hostedWorkouts: defineTable({
		hostUserId: v.string(),
		title: v.string(),
		notes: v.optional(v.string()),
		scheduledAt: v.optional(v.number()),
		status: v.union(v.literal("draft"), v.literal("open"), v.literal("closed")),
		joinToken: v.string(),
		hostParticipation: v.union(
			v.literal("hostOnly"),
			v.literal("hostAndParticipate"),
		),
		createdAt: v.number(),
		openedAt: v.optional(v.number()),
		closedAt: v.optional(v.number()),
		template: v.object({
			strengthBlocks: v.array(
				v.object({
					blockId: v.string(),
					exerciseId: v.optional(exerciseReference),
					exerciseName: v.string(),
					instructions: v.optional(v.string()),
					defaultSets: v.optional(v.number()),
					defaultReps: v.optional(v.number()),
					defaultWeight: v.optional(v.number()),
					unit: v.optional(loadUnit),
					percentageOfOneRepMax: v.optional(v.number()),
				}),
			),
			wodBlocks: v.array(
				v.object({
					blockId: v.string(),
					wodId: v.optional(v.id("wods")),
					name: v.string(),
					type: wodType,
					description: v.optional(v.string()),
					repScheme: v.optional(v.string()),
					timeCapSeconds: v.optional(v.number()),
					durationSeconds: v.optional(v.number()),
					levels: v.array(
						v.object({
							level: hostedLevel,
							label: v.string(),
							description: v.optional(v.string()),
							movements: v.array(wodMovement),
						}),
					),
				}),
			),
		}),
	})
		.index("by_host", ["hostUserId"])
		.index("by_join_token", ["joinToken"]),

	hostedWorkoutParticipants: defineTable({
		hostedWorkoutId: v.id("hostedWorkouts"),
		userId: v.string(),
		sessionId: v.id("workoutSessions"),
		joinedAt: v.number(),
		displayName: v.optional(v.string()),
	})
		.index("by_hosted_workout", ["hostedWorkoutId"])
		.index("by_user", ["userId"])
		.index("by_hosted_workout_user", ["hostedWorkoutId", "userId"])
		.index("by_session", ["sessionId"]),

	hostedWorkoutSubmissions: defineTable({
		hostedWorkoutId: v.id("hostedWorkouts"),
		participantId: v.optional(v.id("hostedWorkoutParticipants")),
		guestName: v.optional(v.string()),
		// Personal-library records created for a signed-in athlete's submission,
		// linked so a re-submit reuses them. Absent for guest submissions.
		wodId: v.optional(v.id("wods")),
		wodResultId: v.optional(v.id("wodResults")),
		wodBlockId: v.string(),
		level: hostedLevel,
		...wodScoreFields,
		submittedAt: v.number(),
	})
		.index("by_hosted_workout", ["hostedWorkoutId"])
		.index("by_hosted_workout_wod", ["hostedWorkoutId", "wodBlockId"]),
});
