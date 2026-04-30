/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as exercises from "../exercises.js";
import type * as lib_oneRepMax from "../lib/oneRepMax.js";
import type * as oneRepMaxes from "../oneRepMaxes.js";
import type * as progress from "../progress.js";
import type * as routines from "../routines.js";
import type * as seed from "../seed.js";
import type * as sets from "../sets.js";
import type * as workoutSessions from "../workoutSessions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  exercises: typeof exercises;
  "lib/oneRepMax": typeof lib_oneRepMax;
  oneRepMaxes: typeof oneRepMaxes;
  progress: typeof progress;
  routines: typeof routines;
  seed: typeof seed;
  sets: typeof sets;
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
