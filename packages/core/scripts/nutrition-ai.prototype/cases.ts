// PROTOTYPE — throwaway. The agreed test cases and how each is graded.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Part } from "./provider";

const here = dirname(fileURLToPath(import.meta.url));

export function imagePart(file: string): Part {
	return {
		kind: "image",
		mediaType: "image/jpeg",
		base64: readFileSync(join(here, "fixtures", file)).toString("base64"),
	};
}

export type LabelCase = {
	id: string;
	file: string;
	/** null = must be rejected as not-a-label. */
	expect: null | {
		per100: Record<string, number>;
		serving: number;
		pack: number;
		brand: RegExp;
		barcode: string;
	};
};

const TORTELLINI = {
	per100: {
		energy_kj: 1160,
		energy_kcal: 275,
		fat: 7.1,
		saturated_fat: 1.8,
		carbs: 42.0,
		sugars: 5.1,
		fibre: 1.7,
		protein: 10.0,
		salt: 0.93,
	},
	serving: 125,
	pack: 250,
	brand: /plus/i,
	barcode: "8710624419011",
};

export const LABEL_CASES: LabelCase[] = [
	{ id: "L1", file: "l1-label.jpg", expect: TORTELLINI },
	{ id: "L2", file: "l2-label-rotated.jpg", expect: TORTELLINI },
	{ id: "L2b", file: "l2b-label-upright-lowq.jpg", expect: TORTELLINI },
	{ id: "L3", file: "l3-not-a-label.jpg", expect: null },
];

export type MealCase = {
	id: string;
	input: { text: string } | { file: string };
	/** Every concept must be covered by some grounded food name (NL NEVO name). */
	concepts: RegExp[];
	kcal: [number, number] | null;
	/** No grounded food name may match these (implausible picks). */
	forbid?: RegExp[];
	/** Extra assertion, e.g. a Lidl ref. */
	refPrefix?: string;
	/** Expect at least one item flagged low confidence. */
	lowConfidence?: boolean;
	noFood?: boolean;
};

export const MEAL_CASES: MealCase[] = [
	{
		id: "T1",
		input: { text: "2 boterhammen met pindakaas en een glas halfvolle melk" },
		concepts: [/brood/i, /pindakaas/i, /melk halfvolle/i],
		forbid: [/turks|stokbrood|krenten|lactosevrij|chocolade/i],
		kcal: [300, 520],
	},
	{
		id: "T2",
		input: { text: "bakje magere kwark met een banaan en een handje walnoten" },
		concepts: [/kwark/i, /banaan|bananen/i, /walnoten|noten/i],
		forbid: [/vruchten|vanille|volle/i],
		kcal: [250, 520],
	},
	{
		id: "T3",
		input: { text: "large chicken caesar salad" },
		concepts: [/kip/i, /sla|salade/i],
		kcal: [400, 950],
	},
	{
		id: "T4",
		input: { text: "croissant van de Lidl" },
		concepts: [/croissant/i],
		kcal: [150, 350],
		refPrefix: "lidl:",
	},
	{
		id: "T5",
		input: { text: "pizza" },
		concepts: [/pizza/i],
		kcal: [250, 1200],
		lowConfidence: true,
	},
	{
		id: "T6",
		input: { text: "asdf" },
		concepts: [],
		kcal: null,
		noFood: true,
	},
	{
		id: "M1",
		input: { file: "m1-boerenkool.jpg" },
		concepts: [/boerenkool/i, /rook/i],
		forbid: [/andijvie|zuurkool|hutspot/i],
		kcal: [500, 1100],
	},
	{
		id: "M2",
		input: { file: "m2-spaghetti.jpg" },
		concepts: [/pasta|spaghetti/i, /bolognese|gehakt|saus/i, /kaas/i],
		kcal: [450, 950],
	},
	{
		id: "M3",
		input: { file: "m3-uitsmijter.jpg" },
		concepts: [/brood/i, /\bei\b|eieren|uitsmijter/i, /kaas/i],
		kcal: [450, 950],
	},
];

export function mealParts(c: MealCase): Part[] {
	return "text" in c.input
		? [{ kind: "text", text: c.input.text }]
		: [
				imagePart(c.input.file),
				{ kind: "text", text: "What is in this meal?" },
			];
}
