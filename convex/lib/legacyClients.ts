import { v } from "convex/values";

/**
 * Arguments that installed builds older than #194 still send. The newest one
 * is TestFlight build 10 (preview channel, JS 61e1f62d), which reads the
 * production backend and cannot take an OTA update of current main.
 *
 * Every field here is accepted and then ignored; none is ever stored. Each
 * stays as narrow as the values old builds actually sent, so typos still
 * fail. Delete this module and its uses once no installed build predates #194
 * (`legacyClients.test.ts` lists each use).
 */

/** Envelope version of nutrition diary and library operations. */
export const legacyEnvelopeVersion = v.optional(v.literal(1));

/** Old builds asked for photo URLs with `photoVersion: 3`, which is now the only behaviour. */
export const legacyPhotoVersion = v.optional(v.literal(3));

/** Payload version old builds stamped on each library record. */
export const legacySchemaVersion = v.optional(
	v.union(v.literal(1), v.literal(2), v.literal(3)),
);

/** Old builds always sent `false`; the diary no longer returns days. */
export const legacyIncludeDays = v.optional(v.boolean());

/** Old builds confirmed unfinished targets; finishing no longer asks. */
export const legacyDiscardUnfinished = v.optional(v.boolean());
