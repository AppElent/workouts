import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { FOOD_CATEGORIES } from "../src/nutrition/types";

/**
 * Reading the committed Lidl bake-off extract (`data/lidl/lidl-bakeoff.json`).
 *
 * A one-time, hand-reviewed transcription of Lidl's ingredient/allergen sheets.
 * Figures are per 100 g as printed; `nameEn`, `category` and `emoji` are
 * Appelent additions. Lidl publishes salt directly and no sodium, so sodium is
 * absent on every row and salt is *not* derived.
 */

const lidlNumber = z.number().finite().nonnegative();

const lidlProductSchema = z.object({
	code: z.number().int().positive(),
	codeType: z.enum(["ean", "article"]),
	sheet: z.enum(["fixed", "promo"]),
	nameNl: z.string().min(1),
	nameEn: z.string().min(1),
	category: z.enum(FOOD_CATEGORIES),
	emoji: z.string().min(1).max(8),
	/** Weight of one piece as printed under "Grammage". */
	grammage: z.number().int().positive(),
	nutrients: z.object({
		energy: lidlNumber,
		fat: lidlNumber,
		saturatedFat: lidlNumber,
		carbs: lidlNumber,
		sugars: lidlNumber,
		fibre: lidlNumber,
		protein: lidlNumber,
		salt: lidlNumber,
	}),
});

const lidlExtractSchema = z.object({
	source: z.string().min(1),
	sheets: z
		.array(
			z.object({
				key: z.enum(["fixed", "promo"]),
				title: z.string().min(1),
				version: z.string().min(1),
				file: z.string().min(1),
			}),
		)
		.min(1),
	basis: z.string().min(1),
	note: z.string().min(1),
	products: z.array(lidlProductSchema).min(1),
});

export type LidlProduct = z.infer<typeof lidlProductSchema>;
export type LidlExtract = z.infer<typeof lidlExtractSchema>;

export function parseLidlExtract(json: string): LidlExtract {
	const extract = lidlExtractSchema.parse(JSON.parse(json));
	const seen = new Set<number>();
	for (const product of extract.products) {
		if (seen.has(product.code)) {
			throw new Error(`Lidl extract lists code ${product.code} twice`);
		}
		seen.add(product.code);
	}
	return {
		...extract,
		products: [...extract.products].sort((a, b) => a.code - b.code),
	};
}

export function readLidlExtract(path: string): LidlExtract {
	return parseLidlExtract(readFileSync(path, "utf8"));
}

/** "27 juli 2026 + 9 september 2026" — the sheet versions, oldest first. */
export function lidlEdition(extract: LidlExtract): string {
	return extract.sheets.map((sheet) => sheet.version).join(" + ");
}

/**
 * The identity a Lidl code is bound to at mint time: both names and the piece
 * weight. Nutrient values are excluded for the same reason as NEVO's — a
 * corrected figure is the same product, a renamed or resized one may not be.
 */
export function lidlIdentityFingerprint(
	product: Pick<LidlProduct, "nameNl" | "nameEn" | "grammage">,
): string {
	return createHash("sha256")
		.update(
			[product.nameNl, product.nameEn, String(product.grammage)].join(" "),
		)
		.digest("hex")
		.slice(0, 16);
}
