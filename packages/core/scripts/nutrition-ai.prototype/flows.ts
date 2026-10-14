// PROTOTYPE — throwaway. The three flows and the grounding strategies.
//
//   label  : photo of a nutrition label → transcribed per-100 values (+ OFF cross-check)
//   meal   : text or meal photo → items → NEVO foods → deterministic totals
//            strategy "retrieve" (B): decompose → local search → pick from candidates
//            strategy "catalog"  (D): whole NEVO list in a cached prompt, pick directly
//            strategy "freeform" (A): model estimates nutrients itself (baseline)

import {
	candidates,
	catalogText,
	foodByRef,
	label,
	MACROS,
	nutrientsFor,
	refOf,
	sumTotals,
	type Totals,
} from "./nevo";
import {
	addUsage,
	type Effort,
	type GenerateResult,
	type LlmProvider,
	type Part,
	type Usage,
	ZERO_USAGE,
} from "./provider";

export type RunConfig = {
	readonly provider: LlmProvider;
	readonly model: string;
	readonly effort: Effort;
};

export type CallLog = {
	step: string;
	ms: number;
	usage: Usage;
	costUsd: number;
	raw: unknown;
};

const num = { type: ["number", "null"] } as const;

function obj(properties: Record<string, unknown>) {
	return {
		type: "object",
		additionalProperties: false,
		required: Object.keys(properties),
		properties,
	};
}

// ───────────────────────────── label ─────────────────────────────

export type LabelData = {
	is_label: boolean;
	product_name: string | null;
	brand: string | null;
	barcode: string | null;
	pack_size: { amount: number; unit: "g" | "ml" } | null;
	basis_unit: "g" | "ml";
	per100: {
		energy_kj: number | null;
		energy_kcal: number | null;
		fat: number | null;
		saturated_fat: number | null;
		carbs: number | null;
		sugars: number | null;
		fibre: number | null;
		protein: number | null;
		salt: number | null;
	};
	serving: { label: string; amount: number; unit: "g" | "ml" } | null;
	notes: string;
};

const LABEL_SCHEMA = obj({
	is_label: { type: "boolean" },
	product_name: { type: ["string", "null"] },
	brand: { type: ["string", "null"] },
	barcode: { type: ["string", "null"] },
	pack_size: {
		anyOf: [
			obj({ amount: { type: "number" }, unit: { enum: ["g", "ml"] } }),
			{ type: "null" },
		],
	},
	basis_unit: { enum: ["g", "ml"] },
	per100: obj({
		energy_kj: num,
		energy_kcal: num,
		fat: num,
		saturated_fat: num,
		carbs: num,
		sugars: num,
		fibre: num,
		protein: num,
		salt: num,
	}),
	serving: {
		anyOf: [
			obj({
				label: { type: "string" },
				amount: { type: "number" },
				unit: { enum: ["g", "ml"] },
			}),
			{ type: "null" },
		],
	},
	notes: { type: "string" },
});

const LABEL_SYSTEM = `You read photos of food packaging for a nutrition diary.
Transcribe the nutrition table exactly as printed — never compute, round, or estimate a value.
- Use the per 100 g / per 100 ml column. Labels may use a decimal comma: "1,8" means 1.8.
- A value that is not printed is null. "<0.5" or "sporen" is 0.
- product_name: the product's descriptive name as printed (keep the language of the label).
- barcode: the digits printed under the barcode, only if fully legible.
- pack_size: the net quantity (e.g. "250g"). serving: the portion the label defines ("per portie 125g"), with the label text as printed.
- If the image is not a nutrition label, set is_label=false and leave the values null.
- notes: anything uncertain (blur, glare, cut-off text). Empty string if nothing.`;

export type LabelCheck = { name: string; ok: boolean; detail: string };

export type LabelResult = {
	data: LabelData;
	checks: LabelCheck[];
	off?: OffProduct | null;
	calls: CallLog[];
};

export async function runLabel(
	config: RunConfig,
	image: Part,
	options: { off?: boolean } = {},
): Promise<LabelResult> {
	const result = await config.provider.generate<LabelData>({
		model: config.model,
		effort: config.effort,
		system: LABEL_SYSTEM,
		parts: [image, { kind: "text", text: "Transcribe this label." }],
		schema: LABEL_SCHEMA,
	});
	const data = result.data;
	const checks = labelChecks(data);
	let off: OffProduct | null | undefined;
	if (options.off && data.barcode) {
		off = await openFoodFacts(data.barcode);
		if (off) checks.push(...offChecks(data, off));
	}
	return { data, checks, off, calls: [log("label", result)] };
}

function labelChecks(data: LabelData): LabelCheck[] {
	const p = data.per100;
	const checks: LabelCheck[] = [];
	if (!data.is_label) return checks;
	if (
		p.energy_kcal != null &&
		p.protein != null &&
		p.carbs != null &&
		p.fat != null
	) {
		const computed =
			4 * p.protein + 4 * p.carbs + 9 * p.fat + 2 * (p.fibre ?? 0);
		const delta = Math.abs(computed - p.energy_kcal) / p.energy_kcal;
		checks.push({
			name: "kcal ≈ 4P+4C+9F+2fib",
			ok: delta < 0.08,
			detail: `${computed.toFixed(0)} vs ${p.energy_kcal} (${(delta * 100).toFixed(1)}%)`,
		});
	}
	if (p.energy_kcal != null && p.energy_kj != null) {
		const ratio = p.energy_kj / p.energy_kcal;
		checks.push({
			name: "kJ/kcal ≈ 4.184",
			ok: Math.abs(ratio - 4.184) < 0.1,
			detail: ratio.toFixed(3),
		});
	}
	if (p.saturated_fat != null && p.fat != null)
		checks.push({
			name: "saturated ≤ fat",
			ok: p.saturated_fat <= p.fat,
			detail: `${p.saturated_fat} ≤ ${p.fat}`,
		});
	if (p.sugars != null && p.carbs != null)
		checks.push({
			name: "sugars ≤ carbs",
			ok: p.sugars <= p.carbs,
			detail: `${p.sugars} ≤ ${p.carbs}`,
		});
	if (data.barcode)
		checks.push({
			name: "EAN checksum",
			ok: eanValid(data.barcode),
			detail: data.barcode,
		});
	return checks;
}

function eanValid(code: string): boolean {
	const digits = code.replace(/\D/g, "");
	if (digits.length !== 13 && digits.length !== 8) return false;
	const body = digits.slice(0, -1).split("").map(Number).reverse();
	const sum = body.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
	return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}

export type OffProduct = {
	name: string;
	brand: string;
	per100: Record<string, number | undefined>;
};

export async function openFoodFacts(
	barcode: string,
): Promise<OffProduct | null> {
	const response = await fetch(
		`https://world.openfoodfacts.org/api/v2/product/${barcode.replace(/\D/g, "")}.json?fields=product_name,brands,nutriments`,
		{ headers: { "User-Agent": "foundry-prototype/0.1 (nutrition-ai)" } },
	);
	if (!response.ok) return null;
	const json = (await response.json()) as {
		status: number;
		product?: {
			product_name?: string;
			brands?: string;
			nutriments?: Record<string, number>;
		};
	};
	if (json.status !== 1 || !json.product) return null;
	const n = json.product.nutriments ?? {};
	return {
		name: json.product.product_name ?? "",
		brand: json.product.brands ?? "",
		per100: {
			energy_kcal: n["energy-kcal_100g"],
			fat: n.fat_100g,
			saturated_fat: n["saturated-fat_100g"],
			carbs: n.carbohydrates_100g,
			sugars: n.sugars_100g,
			fibre: n.fiber_100g,
			protein: n.proteins_100g,
			salt: n.salt_100g,
		},
	};
}

function offChecks(data: LabelData, off: OffProduct): LabelCheck[] {
	const diffs: string[] = [];
	for (const [key, offValue] of Object.entries(off.per100)) {
		const ours = data.per100[key as keyof LabelData["per100"]];
		if (offValue == null || ours == null) continue;
		if (Math.abs(offValue - ours) > Math.max(0.05, ours * 0.03))
			diffs.push(`${key} ${ours}≠${offValue}`);
	}
	return [
		{
			name: "matches Open Food Facts",
			ok: diffs.length === 0,
			detail: diffs.length ? diffs.join(", ") : `${off.brand} ${off.name}`,
		},
	];
}

// ───────────────────────────── meal ─────────────────────────────

export type Strategy = "retrieve" | "catalog" | "freeform";

export type MealItem = {
	description: string;
	grams: number;
	amountBasis: string;
	confidence: "high" | "medium" | "low";
	ref: string | null;
	foodName: string | null;
	totals: Totals | null;
	candidates?: string[];
	reason?: string;
};

export type MealResult = {
	strategy: Strategy;
	status: "ok" | "no_food";
	items: MealItem[];
	totals: Totals;
	calls: CallLog[];
	usage: Usage;
	costUsd: number;
	ms: number;
};

const ITEM_RULES = `- One item per food someone would log separately. A standard dish that is normally eaten as one thing (stamppot, lasagne, a sandwich filling) may stay one item if a database would plausibly have it; otherwise split into components.
- grams: estimated edible weight as eaten (cooked weight for cooked foods). Drinks: 1 ml ≈ 1 g.
- When the amount is not stated, use typical Dutch portions (e.g. slice of bread ≈ 35 g, glass ≈ 200 ml, handful of nuts ≈ 25 g, thin layer of spread ≈ 10–15 g, a medium banana ≈ 120 g edible). Photos: judge size from plate, cutlery and context.
- Unstated variety = the everyday Dutch default, never a speciality: bread → brown/whole-wheat sliced bread, milk → semi-skimmed, cheese → Gouda 48+.
- amount_basis: how you got the grams, e.g. "2 slices × 35 g".
- confidence: "low" when either the food or the amount is mostly a guess.
- If the input contains no food or drink, return status "no_food" and no items.`;

const DECOMPOSE_SCHEMA = obj({
	status: { enum: ["ok", "no_food"] },
	items: {
		type: "array",
		items: obj({
			description: { type: "string" },
			grams: { type: "number" },
			amount_basis: { type: "string" },
			confidence: { enum: ["high", "medium", "low"] },
			brand_or_store: { type: ["string", "null"] },
			search_terms: { type: "array", items: { type: "string" } },
		}),
	},
});

type Decomposed = {
	status: "ok" | "no_food";
	items: {
		description: string;
		grams: number;
		amount_basis: string;
		confidence: "high" | "medium" | "low";
		brand_or_store: string | null;
		search_terms: string[];
	}[];
};

const DECOMPOSE_SYSTEM = `You turn a meal description or a meal photo into the individual foods for a Dutch nutrition diary backed by the NEVO food composition database.
${ITEM_RULES}
- description: short English description including preparation (e.g. "fried egg", "whole-wheat bread").
- brand_or_store: a brand or store named by the user (e.g. "Lidl"), else null.
- search_terms: 3–5 short Dutch search terms in NEVO naming style — noun first, then qualifiers (e.g. "melk halfvolle", "brood volkoren", "ei gebakken", "kaas 48+"). Start specific, end with a single generic noun as fallback. Include the dish name as a term when the item is a dish.`;

const SELECT_SCHEMA = obj({
	choices: {
		type: "array",
		items: obj({
			index: { type: "integer" },
			ref: { type: ["string", "null"] },
			reason: { type: "string" },
		}),
	},
});

const SELECT_SYSTEM = `You match diary items to foods in the NEVO database. For each item you get candidate foods as "ref — Dutch name".
Pick the candidate whose nutrition best represents what was eaten: match preparation (cooked/raw/fried), fat level, and variety. Prefer the plain everyday variant over speciality ones (Turkish, raisin, lactose-free, enriched) unless the item says so. Prefer a candidate from the named store when the item names one ("lidl:" refs are Lidl bake-off products).
Return ref=null only if no candidate is a reasonable nutritional proxy. Keep reason under 12 words.`;

const CATALOG_SCHEMA = obj({
	status: { enum: ["ok", "no_food"] },
	items: {
		type: "array",
		items: obj({
			description: { type: "string" },
			grams: { type: "number" },
			amount_basis: { type: "string" },
			confidence: { enum: ["high", "medium", "low"] },
			ref: { type: ["string", "null"] },
		}),
	},
});

type Catalogued = {
	status: "ok" | "no_food";
	items: {
		description: string;
		grams: number;
		amount_basis: string;
		confidence: "high" | "medium" | "low";
		ref: string | null;
	}[];
};

const CATALOG_SYSTEM = `You turn a meal description or a meal photo into diary items, each matched to a food in the CATALOG above.
${ITEM_RULES}
- ref: the exact ref of the catalog food whose nutrition best represents the item (match preparation, fat level, variety; "lidl:" refs are Lidl bake-off products — use them when the user names Lidl). null only if nothing in the catalog is a reasonable proxy.
- description: short English description including preparation.`;

const FREEFORM_SCHEMA = obj({
	status: { enum: ["ok", "no_food"] },
	items: {
		type: "array",
		items: obj({
			description: { type: "string" },
			grams: { type: "number" },
			amount_basis: { type: "string" },
			confidence: { enum: ["high", "medium", "low"] },
			energy: { type: "number" },
			protein: { type: "number" },
			carbs: { type: "number" },
			fat: { type: "number" },
			saturatedFat: { type: "number" },
			sugars: { type: "number" },
			fibre: { type: "number" },
			salt: { type: "number" },
		}),
	},
});

const FREEFORM_SYSTEM = `You turn a meal description or a meal photo into diary items with nutrition estimates.
${ITEM_RULES}
- For each item give total energy (kcal) and grams of protein, carbs (available), fat, saturatedFat, sugars, fibre, salt for the stated amount.`;

function log<T>(step: string, result: GenerateResult<T>): CallLog {
	return {
		step,
		ms: result.ms,
		usage: result.usage,
		costUsd: result.costUsd,
		raw: result.data,
	};
}

function finish(
	strategy: Strategy,
	status: "ok" | "no_food",
	items: MealItem[],
	calls: CallLog[],
	started: number,
): MealResult {
	return {
		strategy,
		status,
		items,
		totals: sumTotals(
			items.flatMap((item) => (item.totals ? [item.totals] : [])),
		),
		calls,
		usage: calls.reduce((acc, call) => addUsage(acc, call.usage), ZERO_USAGE),
		costUsd: calls.reduce((acc, call) => acc + call.costUsd, 0),
		ms: Date.now() - started,
	};
}

function ground(
	base: Omit<MealItem, "ref" | "foodName" | "totals">,
	ref: string | null,
): MealItem {
	const food = ref ? foodByRef(ref) : undefined;
	return {
		...base,
		ref: food ? refOf(food) : null,
		foodName: food ? label(food) : ref ? `⚠ unknown ref ${ref}` : null,
		totals: food ? nutrientsFor(food, base.grams).totals : null,
	};
}

export async function runMeal(
	config: RunConfig,
	input: readonly Part[],
	strategy: Strategy,
): Promise<MealResult> {
	const started = Date.now();
	const { provider, model, effort } = config;

	if (strategy === "freeform") {
		const result = await provider.generate<{
			status: "ok" | "no_food";
			items: (Record<(typeof MACROS)[number], number> & {
				description: string;
				grams: number;
				amount_basis: string;
				confidence: "high" | "medium" | "low";
			})[];
		}>({
			model,
			effort,
			system: FREEFORM_SYSTEM,
			parts: input,
			schema: FREEFORM_SCHEMA,
		});
		const items = result.data.items.map((item) => ({
			description: item.description,
			grams: item.grams,
			amountBasis: item.amount_basis,
			confidence: item.confidence,
			ref: null,
			foodName: "(model estimate)",
			totals: Object.fromEntries(MACROS.map((m) => [m, item[m]])) as Totals,
		}));
		return finish(
			strategy,
			result.data.status,
			items,
			[log("freeform", result)],
			started,
		);
	}

	if (strategy === "catalog") {
		const result = await provider.generate<Catalogued>({
			model,
			effort,
			cachedPrefix: `CATALOG (ref<TAB>Dutch NEVO name, per 100 g):\n${catalogText()}`,
			system: CATALOG_SYSTEM,
			parts: input,
			schema: CATALOG_SCHEMA,
		});
		const items = result.data.items.map((item) =>
			ground(
				{
					description: item.description,
					grams: item.grams,
					amountBasis: item.amount_basis,
					confidence: item.confidence,
				},
				item.ref,
			),
		);
		return finish(
			strategy,
			result.data.status,
			items,
			[log("catalog", result)],
			started,
		);
	}

	// retrieve: decompose → local search → select
	const decomposed = await provider.generate<Decomposed>({
		model,
		effort,
		system: DECOMPOSE_SYSTEM,
		parts: input,
		schema: DECOMPOSE_SCHEMA,
	});
	const calls = [log("decompose", decomposed)];
	if (
		decomposed.data.status === "no_food" ||
		decomposed.data.items.length === 0
	)
		return finish(strategy, "no_food", [], calls, started);

	const pools = decomposed.data.items.map((item) =>
		candidates(item.search_terms),
	);
	const listing = decomposed.data.items
		.map(
			(item, index) =>
				`Item ${index}: ${item.description} (${item.grams} g${item.brand_or_store ? `, store: ${item.brand_or_store}` : ""})\n` +
				(pools[index].length
					? pools[index]
							.map((food) => `  ${refOf(food)} — ${label(food)}`)
							.join("\n")
					: "  (no candidates)"),
		)
		.join("\n\n");
	const selected = await provider.generate<{
		choices: { index: number; ref: string | null; reason: string }[];
	}>({
		model,
		effort,
		system: SELECT_SYSTEM,
		parts: [{ kind: "text", text: listing }],
		schema: SELECT_SCHEMA,
	});
	calls.push(log("select", selected));

	const items = decomposed.data.items.map((item, index) => {
		const choice = selected.data.choices.find((c) => c.index === index);
		// Only accept refs that were actually offered.
		const offered = pools[index].some((food) => refOf(food) === choice?.ref);
		return {
			...ground(
				{
					description: item.description,
					grams: item.grams,
					amountBasis: item.amount_basis,
					confidence: item.confidence,
				},
				offered ? (choice?.ref ?? null) : null,
			),
			candidates: pools[index].map((food) => `${refOf(food)} ${label(food)}`),
			reason: choice?.reason,
		};
	});
	return finish(strategy, "ok", items, calls, started);
}
