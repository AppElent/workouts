import Anthropic from "@anthropic-ai/sdk";

/**
 * Provider-neutral AI help for nutrition entry (design: designs/nutrition/ai-entry_final.html).
 *
 * The model never invents nutrient figures for a meal: it splits the input into
 * items with search terms, the phone searches its own food library, and a second
 * call picks a candidate per item. Only an item with no reasonable candidate gets
 * an estimate. Labels are transcribed, never computed.
 *
 * Every provider implements `generate`; prompts and schemas stay here so a second
 * provider (OpenAI) is one more adapter. The prototype that chose this shape and
 * the model lives on branch t3code/nutrition-ai-prototype-capture.
 */

export type ImageInput = {
	readonly mediaType: "image/jpeg" | "image/png" | "image/webp";
	readonly base64: string;
};

export type Part =
	| { readonly kind: "text"; readonly text: string }
	| ({ readonly kind: "image" } & ImageInput);

type GenerateRequest = {
	readonly task: "describe" | "select" | "label";
	readonly system: string;
	readonly parts: readonly Part[];
	readonly schema: Record<string, unknown>;
};

export interface NutritionAiProvider {
	generate(request: GenerateRequest): Promise<unknown>;
}

/** Haiku at medium effort passed every prototype case at ~$0.0005 per meal. */
const ANTHROPIC_MODEL = "claude-haiku-5-5";

class AnthropicProvider implements NutritionAiProvider {
	private readonly client: Anthropic;
	constructor(apiKey: string) {
		this.client = new Anthropic({ apiKey });
	}

	async generate(request: GenerateRequest): Promise<unknown> {
		const response = await this.client.messages.create({
			model: ANTHROPIC_MODEL,
			max_tokens: 8000,
			system: request.system,
			thinking: { type: "adaptive" },
			output_config: {
				effort: "medium",
				format: { type: "json_schema", schema: request.schema },
			},
			messages: [
				{
					role: "user",
					content: request.parts.map((part) =>
						part.kind === "text"
							? { type: "text" as const, text: part.text }
							: {
									type: "image" as const,
									source: {
										type: "base64" as const,
										media_type: part.mediaType,
										data: part.base64,
									},
								},
					),
				},
			],
		});
		if (response.stop_reason !== "end_turn") {
			throw new Error(`Provider stopped: ${response.stop_reason}`);
		}
		const text = response.content
			.flatMap((block) => (block.type === "text" ? [block.text] : []))
			.join("");
		return JSON.parse(text);
	}
}

/**
 * Tests and local development without a key set `NUTRITION_AI_PROVIDER=fake`;
 * the fake answers from `NUTRITION_AI_FAKE`, a JSON object keyed by task.
 */
class FakeProvider implements NutritionAiProvider {
	async generate(request: GenerateRequest): Promise<unknown> {
		const fixtures = JSON.parse(process.env.NUTRITION_AI_FAKE ?? "{}");
		if (!(request.task in fixtures))
			throw new Error(`No fake answer for ${request.task}`);
		return fixtures[request.task];
	}
}

export function nutritionAiProvider(): NutritionAiProvider | null {
	if (process.env.NUTRITION_AI_PROVIDER === "fake") return new FakeProvider();
	const key = process.env.ANTHROPIC_API_KEY;
	return key ? new AnthropicProvider(key) : null;
}

// ───────────────────────────── schemas ─────────────────────────────

function object(properties: Record<string, unknown>) {
	return {
		type: "object",
		additionalProperties: false,
		required: Object.keys(properties),
		properties,
	};
}

const nullableNumber = { type: ["number", "null"] };
const confidence = { enum: ["high", "medium", "low"] };
const unit = { enum: ["g", "ml"] };

const DESCRIBE_SCHEMA = object({
	kind: { enum: ["meal", "label", "no_food"] },
	seen: { type: "string" },
	items: {
		type: "array",
		items: object({
			name: { type: "string" },
			amount: { type: "number" },
			unit,
			amountLabel: { type: "string" },
			confidence,
			brand: { type: ["string", "null"] },
			searchTerms: { type: "array", items: { type: "string" } },
		}),
	},
});

const SELECT_SCHEMA = object({
	choices: {
		type: "array",
		items: object({
			index: { type: "integer" },
			ref: { type: ["string", "null"] },
			estimate: {
				anyOf: [
					object({
						energy: { type: "number" },
						protein: { type: "number" },
						carbs: { type: "number" },
						fat: { type: "number" },
						saturatedFat: { type: "number" },
						sugars: { type: "number" },
						fibre: { type: "number" },
						salt: { type: "number" },
					}),
					{ type: "null" },
				],
			},
		}),
	},
});

const LABEL_SCHEMA = object({
	isLabel: { type: "boolean" },
	name: object({ en: { type: "string" }, nl: { type: "string" } }),
	brand: { type: ["string", "null"] },
	barcode: { type: ["string", "null"] },
	packAmount: nullableNumber,
	basis: unit,
	per100: object({
		energyKj: nullableNumber,
		energy: nullableNumber,
		fat: nullableNumber,
		saturatedFat: nullableNumber,
		carbs: nullableNumber,
		sugars: nullableNumber,
		fibre: nullableNumber,
		protein: nullableNumber,
		salt: nullableNumber,
	}),
	servings: {
		type: "array",
		items: object({
			name: object({ en: { type: "string" }, nl: { type: "string" } }),
			amount: { type: "number" },
		}),
	},
	notes: { type: "string" },
});

// ───────────────────────────── prompts ─────────────────────────────

export type AiLocale = "en" | "nl";
const LANGUAGE: Record<AiLocale, string> = { en: "English", nl: "Dutch" };

const ITEM_RULES = `- One item per single food someone would log separately: a sandwich or "boterham met kaas" is bread + cheese (+ butter only when mentioned), never "sandwich with cheese". Only a standard cooked dish normally eaten as one thing (stamppot, lasagne, soup) stays one item. Never list a dish and its own ingredients both.
- amount: estimated edible weight as eaten (cooked weight for cooked foods) in g, or volume in ml for drinks.
- When the amount is not stated, use typical Dutch portions (slice of bread ≈ 35 g, glass ≈ 200 ml, handful of nuts ≈ 25 g, thin layer of spread ≈ 10–15 g, medium banana ≈ 120 g edible). Photos: judge size from plate, cutlery and context.
- Unstated variety = the everyday Dutch default, never a speciality: bread → brown/whole-wheat sliced bread, milk → semi-skimmed, cheese → Gouda 48+.
- confidence: "low" when the food or the amount is mostly a guess.`;

function describeSystem(locale: AiLocale) {
	return `You help someone log food in a Dutch nutrition diary.
First decide what the input is:
- "label": a photo of a nutrition facts table on packaging. Return no items.
- "meal": a description or photo of food or drink that was eaten.
- "no_food": only when the input mentions no food or drink at all (e.g. "asdf"). Any named food, however vague, is a meal.
seen: one short sentence in ${LANGUAGE[locale]} describing what you understood, written so the person can correct it (e.g. "Boerenkoolstamppot met rookworst, één bord").
For a meal:
${ITEM_RULES}
- name: short ${LANGUAGE[locale]} name of the item, including preparation when it matters ("Gebakken ei").
- amountLabel: the amount as the person would say it in ${LANGUAGE[locale]}, at most 3 words ("2 sneetjes", "1 glas", "30 g").
- brand: a brand or store the person named ("Lidl"), else null.
- searchTerms: 3–5 short Dutch search terms in food-database style, noun first then qualifiers ("melk halfvolle", "brood volkoren", "ei gebakken"). Specific first, a single generic noun last. Include the dish name when the item is a dish.`;
}

const SELECT_SYSTEM = `You match diary items to foods in a nutrition database. Each item lists candidate foods as "ref — name".
Pick the candidate whose nutrition best represents what was eaten: match preparation (cooked/raw/fried), fat level and variety. Prefer the plain everyday variant over speciality ones (Turkish, raisin, lactose-free, enriched) unless the item says so, and prefer a candidate from the named store or brand.
Never pick a prepared candidate that already contains another listed item (e.g. porridge "bereid m melk" when the milk is its own item); pick the plain food instead.
ref must be one of the item's candidate refs, or null when none is a reasonable nutritional proxy. Only when ref is null, give estimate: your best estimate of energy (kcal) and grams of protein, available carbs, fat, saturatedFat, sugars, fibre and salt for the item's stated amount. Otherwise estimate is null.`;

function labelSystem(locale: AiLocale) {
	return `You read photos of food packaging for a nutrition diary.
Transcribe the nutrition table exactly as printed — never compute, round, or estimate a value.
- Use the per 100 g / per 100 ml column (basis). Labels may use a decimal comma: "1,8" means 1.8.
- A value that is not printed is null. "<0.5" or "sporen"/"traces" is 0. energy is kcal, energyKj is kJ.
- name: a short everyday product name (at most 40 characters, e.g. "Verse tortellini kaas & tomaat"), not the full legal description; in English and Dutch, keeping the printed language for that side and translating for the other.
- barcode: the digits under the barcode, only if fully legible. packAmount: the net quantity in the basis unit.
- servings: up to 3 everyday portions derived from the label, in this order: the label's own portion ("per portie 125 g"), then the whole package when known. Name them the way a person would, in both languages, without the amount in the name: "1 reep", "1 beker", "2 koekjes", "Hele verpakking". A generic "portie" of a package with a whole number of portions is named by its share: "Portie (½ verpakking)". If the label defines no portion, only the whole package.
- If the image is not a nutrition label, set isLabel false, leave values null and servings empty.
- notes: anything uncertain (blur, glare, cut-off text) in ${LANGUAGE[locale]}; empty string if nothing.`;
}

// ───────────────────────────── tasks ─────────────────────────────

export type DescribedItem = {
	readonly name: string;
	readonly amount: number;
	readonly unit: "g" | "ml";
	readonly amountLabel: string;
	readonly confidence: "high" | "medium" | "low";
	readonly brand: string | null;
	readonly searchTerms: readonly string[];
};

export type Described = {
	readonly kind: "meal" | "label" | "no_food";
	readonly seen: string;
	readonly items: readonly DescribedItem[];
};

export const MAX_ITEMS = 20;
export const MAX_TEXT = 2000;
/** Base64 of a ~2 MB image; the phone resizes to ~1600 px before sending. */
export const MAX_IMAGE_BASE64 = 2_800_000;

export async function describe(
	provider: NutritionAiProvider,
	input: { text?: string; image?: ImageInput; locale: AiLocale },
): Promise<Described> {
	const parts: Part[] = [];
	if (input.image) parts.push({ kind: "image", ...input.image });
	parts.push({
		kind: "text",
		text: input.text?.trim() || "What is in this meal?",
	});
	const raw = (await provider.generate({
		task: "describe",
		system: describeSystem(input.locale),
		parts,
		schema: DESCRIBE_SCHEMA,
	})) as Described;
	const items = (raw.kind === "meal" ? raw.items : [])
		.filter((item) => item.amount > 0 && item.name.trim())
		.slice(0, MAX_ITEMS)
		.map((item) => ({ ...item, searchTerms: item.searchTerms.slice(0, 5) }));
	return {
		kind: raw.kind === "meal" && items.length === 0 ? "no_food" : raw.kind,
		seen: raw.seen,
		items,
	};
}

export type SelectInput = {
	readonly name: string;
	readonly amount: number;
	readonly unit: "g" | "ml";
	readonly brand: string | null;
	readonly candidates: readonly { readonly ref: string; readonly name: string }[];
};

export type EstimateNutrients = Readonly<
	Record<
		| "energy"
		| "protein"
		| "carbs"
		| "fat"
		| "saturatedFat"
		| "sugars"
		| "fibre"
		| "salt",
		number
	>
>;

export type Choice = {
	readonly index: number;
	readonly ref: string | null;
	readonly estimate: EstimateNutrients | null;
};

export async function select(
	provider: NutritionAiProvider,
	items: readonly SelectInput[],
): Promise<Choice[]> {
	const listing = items
		.map(
			(item, index) =>
				`Item ${index}: ${item.name} (${item.amount} ${item.unit}${item.brand ? `, brand/store: ${item.brand}` : ""})\n` +
				(item.candidates.length
					? item.candidates.map((c) => `  ${c.ref} — ${c.name}`).join("\n")
					: "  (no candidates)"),
		)
		.join("\n\n");
	const raw = (await provider.generate({
		task: "select",
		system: SELECT_SYSTEM,
		parts: [{ kind: "text", text: listing }],
		schema: SELECT_SCHEMA,
	})) as { choices: Choice[] };
	// One answer per item, and a ref only if it was actually offered.
	return items.map((item, index) => {
		const choice = raw.choices.find((c) => c.index === index);
		const offered = item.candidates.some((c) => c.ref === choice?.ref);
		const ref = offered ? (choice?.ref ?? null) : null;
		const estimate =
			ref === null && choice?.estimate && validEstimate(choice.estimate)
				? choice.estimate
				: null;
		return { index, ref, estimate };
	});
}

function validEstimate(estimate: EstimateNutrients): boolean {
	return Object.values(estimate).every(
		(value) => Number.isFinite(value) && value >= 0,
	);
}

export type LabelNutrient =
	| "energyKj"
	| "energy"
	| "fat"
	| "saturatedFat"
	| "carbs"
	| "sugars"
	| "fibre"
	| "protein"
	| "salt";

export type LabelReading = {
	readonly isLabel: boolean;
	readonly name: { readonly en: string; readonly nl: string };
	readonly brand: string | null;
	readonly barcode: string | null;
	readonly packAmount: number | null;
	readonly basis: "g" | "ml";
	readonly per100: Readonly<Record<LabelNutrient, number | null>>;
	readonly servings: readonly {
		readonly name: { readonly en: string; readonly nl: string };
		readonly amount: number;
	}[];
	readonly notes: string;
};

export async function readLabel(
	provider: NutritionAiProvider,
	input: { image: ImageInput; locale: AiLocale },
): Promise<LabelReading> {
	const raw = (await provider.generate({
		task: "label",
		system: labelSystem(input.locale),
		parts: [
			{ kind: "image", ...input.image },
			{ kind: "text", text: "Transcribe this label." },
		],
		schema: LABEL_SCHEMA,
	})) as LabelReading;
	const barcode = raw.barcode?.replace(/\D/g, "") || null;
	return {
		...raw,
		barcode: barcode && validEan(barcode) ? barcode : null,
		servings: raw.isLabel
			? raw.servings.filter((serving) => serving.amount > 0).slice(0, 3)
			: [],
	};
}

/** EAN-8/13 checksum: a misread digit fails it, so a wrong barcode never lands. */
export function validEan(digits: string): boolean {
	if (digits.length !== 13 && digits.length !== 8) return false;
	const body = digits.slice(0, -1).split("").map(Number).reverse();
	const sum = body.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
	return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}
