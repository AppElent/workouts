import { z } from "zod";
import { FOOD_CATEGORIES } from "./types";

/**
 * The shipped artifact's schema.
 *
 * Imported by the generator and by tests only — never by `./index.ts`. `zod` is
 * a devDependency of `@workouts/core` (spec #68, D15) precisely so that the
 * phone bundle stays dependency-free: the artifact the app reads has already
 * been validated at generation time and again in CI by `artifact.test.ts`.
 */

const bilingualString = z.string().min(1);

/**
 * A nutrient cell: a number, the trace sentinel, or null for absent. `null` is
 * spelled out rather than "just leave the slot empty" so a truncated array
 * cannot silently read as a row of absences.
 */
export const nutrientCellSchema = z.union([
	z.number().finite().nonnegative(),
	z.literal("t"),
	z.null(),
]);

export const servingSchema = z
	.object({
		en: bilingualString,
		nl: bilingualString,
		amount: z.number().positive(),
		ml: z.number().positive().optional(),
		basis: z.enum(["one-to-one", "density"]).optional(),
		note: z.string().min(1).optional(),
	})
	.refine(
		(serving) => serving.ml === undefined || serving.basis !== undefined,
		{
			message:
				"a volume-labelled serving must declare how the volume became an amount (basis: one-to-one | density)",
		},
	);

export const promotionSchema = z.object({
	en: bilingualString,
	nl: bilingualString,
	emoji: z.string().min(1).max(8),
	aliasEn: z.array(bilingualString).optional(),
	aliasNl: z.array(bilingualString).optional(),
	// Three is the spec's cap: a picker longer than that stops being a shortcut.
	servings: z.array(servingSchema).max(3),
});

const sourceSchema = z.literal("lidl").optional();

/** `${source}:${code}` — the key a code is unique under. */
function sourceKey(food: { src?: string; code: number }): string {
	return `${food.src ?? "nevo"}:${food.code}`;
}

/** Sort rank per source: NEVO first, then Lidl, each block ordered by code. */
function sourceRank(src: string | undefined): number {
	return src === undefined ? 0 : 1;
}

export const wireFoodSchema = z.object({
	id: z.string().regex(/^shipped:[a-z0-9-]+$/),
	src: sourceSchema,
	code: z.number().int().positive(),
	en: bilingualString,
	nl: bilingualString,
	cat: z.enum(FOOD_CATEGORIES),
	grp: z.string().regex(/^[a-z0-9-]+$/),
	unit: z.literal("ml").optional(),
	syn: z.array(bilingualString).optional(),
	n: z.array(nutrientCellSchema),
	p: promotionSchema.optional(),
	retired: z.literal(true).optional(),
});

const sourceMetaSchema = z.object({
	name: bilingualString,
	edition: bilingualString,
	version: bilingualString,
	publisher: bilingualString,
	saltDerived: z.boolean(),
});

export const shippedArtifactSchema = z
	.object({
		schemaVersion: z.number().int().positive(),
		dataset: z.object({
			name: bilingualString,
			edition: bilingualString,
			version: bilingualString,
			publisher: bilingualString,
		}),
		generatedFrom: bilingualString,
		sources: z.object({
			nevo: sourceMetaSchema,
			lidl: sourceMetaSchema.optional(),
		}),
		licence: z.object({
			attribution: bilingualString,
			attributionMixed: bilingualString,
			constraints: z.array(bilingualString).min(1),
			source: bilingualString,
		}),
		derived: z.object({
			salt: z.object({
				from: z.literal("sodium"),
				formula: bilingualString,
				origin: z.literal("appelent-derived"),
				rationale: bilingualString,
			}),
		}),
		nutrientOrder: z.array(z.string()).min(1),
		nutrientUnits: z.record(z.string(), z.string()),
		categories: z.array(z.enum(FOOD_CATEGORIES)),
		groups: z.record(
			z.string(),
			z.object({
				en: bilingualString,
				nl: bilingualString,
				category: z.enum(FOOD_CATEGORIES),
			}),
		),
		foods: z.array(wireFoodSchema).min(1),
	})
	.superRefine((artifact, ctx) => {
		const width = artifact.nutrientOrder.length;
		const seenIds = new Set<string>();
		const seenCodes = new Set<string>();
		for (const food of artifact.foods) {
			if (food.n.length !== width) {
				ctx.addIssue({
					code: "custom",
					message: `food ${food.id} carries ${food.n.length} nutrient cells, expected ${width}`,
				});
			}
			if (seenIds.has(food.id)) {
				ctx.addIssue({
					code: "custom",
					message: `duplicate shipped id ${food.id}`,
				});
			}
			if (seenCodes.has(sourceKey(food))) {
				ctx.addIssue({
					code: "custom",
					message: `duplicate source code ${sourceKey(food)}`,
				});
			}
			if (!(food.grp in artifact.groups)) {
				ctx.addIssue({
					code: "custom",
					message: `food ${food.id} references unknown group ${food.grp}`,
				});
			}
			if (food.src && !artifact.sources[food.src]) {
				ctx.addIssue({
					code: "custom",
					message: `food ${food.id} comes from source ${food.src}, which has no entry in sources`,
				});
			}
			// A drink nobody can portion is a bad search result, so the spec makes
			// a practical serving the price of promotion.
			if (food.p && food.cat === "drinks" && food.p.servings.length === 0) {
				ctx.addIssue({
					code: "custom",
					message: `promoted beverage ${food.id} has no authored serving`,
				});
			}
			seenIds.add(food.id);
			seenCodes.add(sourceKey(food));
		}
		for (let index = 1; index < artifact.foods.length; index += 1) {
			const previous = artifact.foods[index - 1];
			const current = artifact.foods[index];
			if (!previous || !current) continue;
			const rankDelta = sourceRank(previous.src) - sourceRank(current.src);
			if (rankDelta > 0 || (rankDelta === 0 && previous.code > current.code)) {
				ctx.addIssue({
					code: "custom",
					message:
						"foods must be ordered by source then code so regeneration produces a stable diff",
				});
			}
		}
	});

export const lockEntrySchema = z.object({
	src: sourceSchema,
	code: z.number().int().positive(),
	id: z.string().regex(/^shipped:[a-z0-9-]+$/),
	status: z.enum(["active", "retired"]),
	/** Hash of the NEVO identity fields at the time this id was bound. */
	identity: z.string().regex(/^[0-9a-f]{16}$/),
	mintedIn: bilingualString,
	retiredIn: bilingualString.optional(),
	/** The last record generated for a food before it left the extract. */
	lastKnown: wireFoodSchema.optional(),
});

export const shippedLockSchema = z
	.object({
		schemaVersion: z.number().int().positive(),
		note: bilingualString,
		entries: z.array(lockEntrySchema),
	})
	.superRefine((lock, ctx) => {
		const seenIds = new Set<string>();
		const activeCodes = new Set<string>();
		for (const entry of lock.entries) {
			if (seenIds.has(entry.id)) {
				ctx.addIssue({
					code: "custom",
					message: `id ${entry.id} appears twice; ids are never reused`,
				});
			}
			seenIds.add(entry.id);
			if (entry.status === "active") {
				if (activeCodes.has(sourceKey(entry))) {
					ctx.addIssue({
						code: "custom",
						message: `source code ${sourceKey(entry)} has two active ids; a code maps to at most one live food`,
					});
				}
				activeCodes.add(sourceKey(entry));
			}
		}
	});

export type ShippedLock = z.infer<typeof shippedLockSchema>;
export type LockEntry = z.infer<typeof lockEntrySchema>;
