/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as activities from "../activities.js";
import type * as bodyMetrics from "../bodyMetrics.js";
import type * as enduranceActivities from "../enduranceActivities.js";
import type * as exercises from "../exercises.js";
import type * as exportData from "../exportData.js";
import type * as hostedWorkoutParticipants from "../hostedWorkoutParticipants.js";
import type * as hostedWorkoutSubmissions from "../hostedWorkoutSubmissions.js";
import type * as hostedWorkouts from "../hostedWorkouts.js";
import type * as lib_appleSignIn from "../lib/appleSignIn.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_diaryDays from "../lib/diaryDays.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_exerciseCatalog from "../lib/exerciseCatalog.js";
import type * as lib_foodPhotos from "../lib/foodPhotos.js";
import type * as lib_goalHistory from "../lib/goalHistory.js";
import type * as lib_hosted from "../lib/hosted.js";
import type * as lib_nutritionAi from "../lib/nutritionAi.js";
import type * as lib_nutritionLibraryIndex from "../lib/nutritionLibraryIndex.js";
import type * as lib_operationReceipt from "../lib/operationReceipt.js";
import type * as lib_personalData from "../lib/personalData.js";
import type * as lib_strengthReferences from "../lib/strengthReferences.js";
import type * as lib_strengthSession from "../lib/strengthSession.js";
import type * as lib_testDataBaseline from "../lib/testDataBaseline.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_wods from "../lib/wods.js";
import type * as nutritionActivityMarker from "../nutritionActivityMarker.js";
import type * as nutritionAi from "../nutritionAi.js";
import type * as nutritionDiary from "../nutritionDiary.js";
import type * as nutritionDrafts from "../nutritionDrafts.js";
import type * as nutritionFoodPhotos from "../nutritionFoodPhotos.js";
import type * as nutritionGoals from "../nutritionGoals.js";
import type * as nutritionLibrary from "../nutritionLibrary.js";
import type * as nutritionReview from "../nutritionReview.js";
import type * as oneRepMaxes from "../oneRepMaxes.js";
import type * as personalMeasures from "../personalMeasures.js";
import type * as progress from "../progress.js";
import type * as routines from "../routines.js";
import type * as seed from "../seed.js";
import type * as seedData_wods from "../seedData/wods.js";
import type * as sets from "../sets.js";
import type * as supplementaryServings from "../supplementaryServings.js";
import type * as testData from "../testData.js";
import type * as wodResults from "../wodResults.js";
import type * as wods from "../wods.js";
import type * as workoutSessions from "../workoutSessions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  activities: typeof activities;
  bodyMetrics: typeof bodyMetrics;
  enduranceActivities: typeof enduranceActivities;
  exercises: typeof exercises;
  exportData: typeof exportData;
  hostedWorkoutParticipants: typeof hostedWorkoutParticipants;
  hostedWorkoutSubmissions: typeof hostedWorkoutSubmissions;
  hostedWorkouts: typeof hostedWorkouts;
  "lib/appleSignIn": typeof lib_appleSignIn;
  "lib/auth": typeof lib_auth;
  "lib/diaryDays": typeof lib_diaryDays;
  "lib/errors": typeof lib_errors;
  "lib/exerciseCatalog": typeof lib_exerciseCatalog;
  "lib/foodPhotos": typeof lib_foodPhotos;
  "lib/goalHistory": typeof lib_goalHistory;
  "lib/hosted": typeof lib_hosted;
  "lib/nutritionAi": typeof lib_nutritionAi;
  "lib/nutritionLibraryIndex": typeof lib_nutritionLibraryIndex;
  "lib/operationReceipt": typeof lib_operationReceipt;
  "lib/personalData": typeof lib_personalData;
  "lib/strengthReferences": typeof lib_strengthReferences;
  "lib/strengthSession": typeof lib_strengthSession;
  "lib/testDataBaseline": typeof lib_testDataBaseline;
  "lib/validators": typeof lib_validators;
  "lib/wods": typeof lib_wods;
  nutritionActivityMarker: typeof nutritionActivityMarker;
  nutritionAi: typeof nutritionAi;
  nutritionDiary: typeof nutritionDiary;
  nutritionDrafts: typeof nutritionDrafts;
  nutritionFoodPhotos: typeof nutritionFoodPhotos;
  nutritionGoals: typeof nutritionGoals;
  nutritionLibrary: typeof nutritionLibrary;
  nutritionReview: typeof nutritionReview;
  oneRepMaxes: typeof oneRepMaxes;
  personalMeasures: typeof personalMeasures;
  progress: typeof progress;
  routines: typeof routines;
  seed: typeof seed;
  "seedData/wods": typeof seedData_wods;
  sets: typeof sets;
  supplementaryServings: typeof supplementaryServings;
  testData: typeof testData;
  wodResults: typeof wodResults;
  wods: typeof wods;
  workoutSessions: typeof workoutSessions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
