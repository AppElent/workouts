import Anthropic from "@anthropic-ai/sdk";
import {
	type Locale,
	NUTRITION_AI_LIMITS,
	NUTRITION_AI_PLAUSIBILITY,
} from "@foundry/core";

/**
 * Provider-neutral AI help for nutrition entry (design: designs/nutrition/ai-entry_final.html).
 *
 * Basic ingredients are grounded: the model splits the input into items with
 * search terms, the phone searches its own food library, and a second call picks
 * a candidate per item; only an ingredient with no reasonable candidate gets an
 * estimate. A ready-made product (a store sandwich, a restaurant meal) stays one
 * item, estimated from its components, unless it matches a Personal Food.
 * Labels are transcribed, never computed.
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

export type Source = { readonly title: string; readonly url: string };

export type ResearchResult = {
	/** What was found, in plain text; empty when nothing useful turned up. */
	readonly notes: string;
	readonly sources: readonly Source[];
};

export interface NutritionAiProvider {
	generate(request: GenerateRequest): Promise<unknown>;
	/** Plain-text web lookup; optional because it costs more per call. */
	research?(request: { system: string; text: string }): Promise<ResearchResult>;
}

/**
 * Haiku without thinking at low effort: p50 ~3 s for describe + select against
 * ~7 s with adaptive thinking, measured with scripts/nutrition-ai.eval.prototype.ts.
 */
const ANTHROPIC_MODEL = "claude-haiku-5-5";
/** One attempt and one retry stay inside what the phone waits for. */
const GENERATE_TIMEOUT_MS = 14_000;
const RESEARCH_TIMEOUT_MS = 40_000;

class AnthropicProvider implements NutritionAiProvider {
	private readonly client: Anthropic;
	constructor(apiKey: string) {
		this.client = new Anthropic({ apiKey });
	}

	async generate(request: GenerateRequest): Promise<unknown> {
		const response = await this.client.messages.create(
			{
				model: ANTHROPIC_MODEL,
				max_tokens: 8000,
				system: request.system,
				thinking: { type: "disabled" },
				output_config: {
					effort: "low",
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
			},
			{ timeout: GENERATE_TIMEOUT_MS, maxRetries: 1 },
		);
		if (response.stop_reason !== "end_turn") {
			throw new Error(`Provider stopped: ${response.stop_reason}`);
		}
		const text = response.content
			.flatMap((block) => (block.type === "text" ? [block.text] : []))
			.join("");
		return JSON.parse(text);
	}

	/**
	 * Web search runs as its own call: its results carry citations, which do
	 * not combine with a JSON schema, so it returns notes that the structured
	 * describe call reads as context.
	 */
	async research(request: {
		system: string;
		text: string;
	}): Promise<ResearchResult> {
		const messages: Anthropic.MessageParam[] = [
			{ role: "user", content: request.text },
		];
		// The server-side search loop may pause; resume it a few times at most.
		for (let attempt = 0; attempt < 3; attempt++) {
			const response = await this.client.messages.create(
				{
					model: ANTHROPIC_MODEL,
					max_tokens: 4000,
					system: request.system,
					tools: [
						{
							type: "web_search_20250305",
							name: "web_search",
							max_uses: 3,
							user_location: { type: "approximate", country: "NL" },
						},
					],
					messages,
				},
				{ timeout: RESEARCH_TIMEOUT_MS, maxRetries: 0 },
			);
			if (response.stop_reason === "pause_turn") {
				messages.push({ role: "assistant", content: response.content });
				continue;
			}
			const sources = new Map<string, string>();
			let notes = "";
			for (const block of response.content) {
				if (block.type !== "text") continue;
				notes += block.text;
				for (const citation of block.citations ?? [])
					if (citation.type === "web_search_result_location")
						sources.set(citation.url, citation.title ?? citation.url);
			}
			notes = notes.trim();
			return notes === "" || notes.endsWith("NONE")
				? { notes: "", sources: [] }
				: {
						notes,
						sources: [...sources].map(([url, title]) => ({ url, title })),
					};
		}
		return { notes: "", sources: [] };
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

const NUTRIENTS = {
	energy: { type: "number" },
	protein: { type: "number" },
	carbs: { type: "number" },
	fat: { type: "number" },
	saturatedFat: { type: "number" },
	sugars: { type: "number" },
	fibre: { type: "number" },
	salt: { type: "number" },
};

const DESCRIBE_SCHEMA = object({
	kind: { enum: ["meal", "label", "no_food"] },
	seen: { type: "string" },
	title: { type: "string" },
	question: {
		anyOf: [
			object({
				text: { type: "string" },
				options: { type: "array", items: { type: "string" } },
			}),
			{ type: "null" },
		],
	},
	items: {
		type: "array",
		items: object({
			kind: { enum: ["ingredient", "product"] },
			name: { type: "string" },
			amount: { type: "number" },
			unit,
			grams: { type: "number" },
			id: { type: ["string", "null"] },
			amountLabel: { type: "string" },
			amountStated: { type: "boolean" },
			confidence,
			brand: { type: ["string", "null"] },
			searchTerms: { type: "array", items: { type: "string" } },
			components: {
				type: "array",
				items: object({
					name: { type: "string" },
					grams: { type: "number" },
					...NUTRIENTS,
				}),
			},
		}),
	},
});

const SELECT_SCHEMA = object({
	choices: {
		type: "array",
		items: object({
			index: { type: "integer" },
			ref: { type: ["string", "null"] },
			estimate: { anyOf: [object(NUTRIENTS), { type: "null" }] },
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

export type AiLocale = Locale;
const LANGUAGE: Record<AiLocale, string> = { en: "English", nl: "Dutch" };

const ITEM_RULES = `- Every item is one of two kinds:
  - "ingredient": a single basic food a generic food database covers well (apple, semi-skimmed milk, Gouda, brown bread, boiled potatoes), or part of something made at home. A home-made sandwich or "boterham met kaas" is bread + cheese (+ butter only when mentioned) as separate ingredients.
  - "product": something bought or served ready-made and eaten as one thing: a sandwich, wrap, salad or meal from a named store, chain, bakery or restaurant ("broodje gezond van de bakker", "Big Mac", "AH maaltijdsalade"), a snack-bar item, or a standard dish (stamppot, lasagne, soup, pasta bolognese, nasi, curry). Keep it one item; never split it into separate ingredients, and never list a product and its own ingredients both. An extra the person names on top of a dish ("appeltaart met slagroom", "friet met mayo") is its own item, so a database match for the dish never loses it.
- For a product, use what you know about the real thing: a store sandwich is usually a larger, often multigrain or speciality roll with generous fillings and sauce, not plain white bread with a slice of meat. Read the name for cues ("pittig" = spicy sauce, "krokant"/"crispy" = fried coating) and include the typical sauce, vegetables and garnish.
- components: for a product, 2–8 parts that make it up (roll, filling, sauce, vegetables) with their grams and your best estimate of their nutrition for those grams: energy (kcal) and grams of protein, available carbs, fat, saturatedFat, sugars, fibre and salt. The product's grams must equal the sum of its components. For an ingredient, components is empty.
- For a well-known chain product use its published size and energy: Big Mac ≈ 215 g and 510 kcal, medium fries ≈ 115 g and 340 kcal, a medium cola ≈ 400 ml and 170 kcal, Snickers ≈ 50 g and 245 kcal; its components must add up to that energy (a Big Mac is bun 75 g and 200 kcal, two patties 70 g and 180 kcal, cheese, sauce and salad 70 g and 130 kcal). A filled store roll with meat and a mayonnaise-based sauce is about 200 g and 450–600 kcal: count the sauce (20 g ≈ 100–140 kcal). A snack-bar kapsalon is about 500 g and 1200–1500 kcal. A product's energy must be plausible for its weight: most are 1.5–3 kcal per g; only fried snacks and chocolate go higher.
- A correction like "half a portion" scales a product: it stays a product with every component scaled. A correction never turns a product into ingredients.
- amount: estimated edible weight as eaten (cooked weight for cooked foods) in g, or volume in ml for drinks. A weight the person states stays exactly as stated, in the state they said: "80 g pasta ongekookt" is 80 g of dry pasta, named "Pasta ongekookt", never converted to cooked. A stated weight of oats, pasta, rice or legumes that does not say cooked is the dry weight: "100 g havermout" is named "Havermout droog", "80 g pasta" is "Pasta ongekookt", with exactly that amount. Cooked grains, pasta, rice, porridge and legumes weigh 2.5–4 times their dry weight; say the preparation in the name ("Havermout gekookt", "Rijst gekookt") and in the search terms.
- Frying fat: do not add a separate oil or butter item for something fried, unless the person names the fat. When they name it ("gebakken in boter"), give the food as its plain variant ("Ei gekookt", searchTerms for the plain food) with the fat as its own item of about 5 g per egg or per piece of meat, so 3 eggs in butter means 15 g butter and the fat counts once. Butter on bread is a spread, not frying fat: "boterham met boter en een gebakken ei" keeps "Gebakken ei" with its fried searchTerms.
- Something on top that was named stays its own item, even with a dish that is one product: "appeltaart met slagroom" is Appeltaart (120 g) and Slagroom (30 g).
- grams: the same amount as a weight in g (for drinks: the volume times its density; water-like drinks 1 ml ≈ 1 g).
- When the amount is not stated, use typical Dutch portions (half a pizza ≈ 250 g, whole ≈ 500 g, "boterham" ≈ one slice of bread, slice of bread ≈ 35 g, a protein shake is one item of its powder, 1 scoop ≈ 30 g, the water adds nothing, slice of cheese ≈ 20 g, slice of meat ≈ 15 g, egg ≈ 55 g edible, glass ≈ 200 ml, beer ≈ 250 ml, handful of nuts ≈ 25 g, thin layer of spread ≈ 10–15 g, spoon of peanut butter ≈ 15 g, medium banana ≈ 120 g edible, medium apple ≈ 150 g edible, plate of pasta ≈ 350 g cooked, slice of pie ≈ 120 g). Photos: judge size from plate, cutlery and context.
- Do not add a preparation the person did not say: "200 g kipfilet" is "Kipfilet", not fried or baked. Keep one they did say, in the name and in searchTerms: "200 g rauwe kipfilet" is "Kipfilet rauw" with searchTerms ["kipfilet rauw"].
- Unstated variety of an ingredient = the everyday Dutch default, never a speciality: bread → brown/whole-wheat sliced bread, milk → semi-skimmed, cheese → Gouda 48+.
- confidence: "low" when the food or the amount is mostly a guess.`;

const RESEARCH_SYSTEM = `You look up nutrition facts for a Dutch food diary.
If the text names a specific product from a store, brand, chain or restaurant (e.g. a sandwich from Spar, a McDonald's burger, an Albert Heijn salad), search the web for that exact product's nutrition values and contents. Prefer the seller's own product page.
Answer in a few short lines per product: its exact name, weight per piece, energy (kcal), protein, carbohydrates, fat, saturated fat, sugars, fibre and salt, per piece or per 100 g as published, and the main ingredients. Only report figures you found; never invent them.
If the text names no specific store or brand product, or nothing usable is found, answer exactly NONE.`;

function describeSystem(locale: AiLocale) {
	return `You help someone log food in a Dutch nutrition diary.
First decide what the input is:
- "label": a photo of a nutrition facts table on packaging. Return no items.
- "meal": a description or photo of food or drink that was eaten.
- "no_food": only when the input names no food or drink at all (e.g. "asdf", "lekkere lunch", "hetzelfde als gisteren"). Any named food, however vague, is a meal, also one word that reads as something else ("peer" is a pear).
seen: one short sentence in ${LANGUAGE[locale]} describing what you understood, written so the person can correct it; for a product, name what is in it (e.g. "Kapsalon (snackbar): friet met shoarma, gesmolten kaas, sla en knoflooksaus"). For no_food, say in one friendly sentence why you cannot log it and what to write instead (e.g. "Ik kan eerdere maaltijden niet zien; beschrijf wat je at."), without repeating the input.
title: a short ${LANGUAGE[locale]} name for everything together, as the person would save it as a food (at most 40 characters, e.g. "Kapsalon"), without the store.
question: at most one short question in ${LANGUAGE[locale]} with 2–4 short answer options, only when the answer would change the total energy by more than 15% AND more than 50 kcal (preparation, size, sauce), and no typical default is obvious; otherwise null. Most inputs need no question: use the default. For a stated weight of pasta or rice without its state, ask whether it was weighed dry or cooked, with the dry weight as the default. One exception to asking: a stated gram weight of meat or fish that does not say raw or prepared, such as "200 g kipfilet": ask whether the weight is raw or prepared, and describe it as prepared meanwhile. Never ask about bread type, milk type, a thin spread or anything small. Never ask what the person already said.
For a meal:
${ITEM_RULES}
- name: short ${LANGUAGE[locale]} name of the item, including preparation when it matters ("Gebakken ei"); for a product include the store or brand in brackets ("Caesar wrap (AH)").
- amountStated: true when the person gave the amount, count or size, in the text, the photo or a correction; false when you chose a typical portion.
- amountLabel: the amount as the person would say it in ${LANGUAGE[locale]}, at most 3 words ("2 sneetjes", "1 broodje", "30 g").
- brand: a brand or store the person named ("Spar"), else null.
- When web findings are given for a product, base its weight, components and nutrition on those published figures (split them sensibly over the components) instead of your own guess: use the published weight, scale per-100 g figures to it, compute missing energy from the macros (4 kcal/g protein and carbohydrates, 9 kcal/g fat), and use confidence "high" when figures were found.
- searchTerms: 3–5 short Dutch search terms in food-database style, noun first then qualifiers ("melk halfvolle", "brood volkoren", "ei gebakken"). Specific first, a single generic noun last. For a product, start with its own name ("wrap caesar").
When a previous result and corrections are given, return the complete updated result: apply every correction, keep everything the corrections do not touch (items, names, amounts, components) exactly as it was, and do not ask a question that was already answered. Every previous item has an id: return it on the item it became, also when renamed; a new item has id null, and on a first analysis every id is null. A correction naming a different dish replaces the items it is made of: "het was een tosti" after bread and cheese is one Tosti item with the weight of the whole dish (bread and filling together) and no bread or cheese row left, and seen never names a dish the items are not. Seen and title do not mention what was removed, also not to say it is gone: they describe only what is there. Something a correction replaces ("kip in plaats van shoarma") must be gone from the item's name, the seen sentence and the components, with the energy recalculated. Items in removedByPerson were deleted by the person: leave them out even though the description mentions them, unless a correction brings them back. After a correction, seen and title describe the result as it now is, and never mention what was removed or how it changed ("Bruin brood met kaas", not "... zonder melk" or "melk is weggelaten").`;
}

/** The same figures the phone checks a cooked estimate against. */
const COOKED = NUTRITION_AI_PLAUSIBILITY.cookedKcalPer100g;

const SELECT_SYSTEM = `You match diary items to foods in a nutrition database. Each item lists candidate foods as "ref — name".
Pick the candidate whose nutrition best represents what was eaten: match preparation (cooked/raw/fried), fat level and variety. Prefer the plain everyday variant over speciality ones (Turkish, raisin, lactose-free, enriched) unless the item says so, and prefer a candidate from the named store or brand.
A candidate marked "bereid" (prepared) covers the usual ways of cooking that food, baked, grilled or boiled alike: "Kipfilet gebakken" and "Kipfilet" pick "Kipfilet (bereid)", never an estimate. Estimate only when no candidate is that food.
A composed food is never a pure ingredient: a sauce with meat is not plain mince. When a separate fat item (butter, oil) is listed, pick a boiled or plain variant of the food it was fried in, never a fried one, so the fat counts once. Never pick a prepared candidate that already contains another listed item (e.g. porridge "bereid m melk" when the milk is its own item); pick the plain food instead.
An item whose amount is a cooked weight must not get a dry or raw candidate: "Havermout gekookt" is not dry oats, "Rijst gekookt" is not uncooked rice. Dried grains, pasta and legumes have 3–4 times the energy per gram. If only dry or raw candidates exist, ref is null and give an estimate for the cooked food (cooked oats about ${COOKED.oats} kcal per 100 g, cooked rice about ${COOKED.rice}, cooked pasta about ${COOKED.pasta}).
Cheese without a stated fat level is the 48+ kind, not 20+ or 30+.
An item marked "product" is a ready-made product: pick a candidate only when it is that same dish or product (the person's own saved food, or the same dish in the database such as "Appeltaart" for a slice of apple pie), never one of its ingredients; otherwise ref is null and estimate is null.
ref must be one of the item's candidate refs, or null when none is a reasonable nutritional proxy. Only when ref is null, give estimate: your best estimate of energy (kcal) and grams of protein, available carbs, fat, saturatedFat, sugars, fibre and salt per 100 g (or per 100 ml for a drink) of the food as eaten, never for the whole portion. The figures must fit what the item's name says it is: protein powder ≈ 400 kcal per 100 g, a drink is a drink. Otherwise estimate is null.`;

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

export type Component = {
	readonly name: string;
	readonly grams: number;
} & EstimateNutrients;

export type DescribedItem = {
	/** On a correction: the id of the previous row this item is. */
	readonly id?: string | null;
	readonly kind: "ingredient" | "product";
	readonly name: string;
	readonly amount: number;
	readonly unit: "g" | "ml";
	/** The amount as a weight, so a per-gram food can be used for a drink. */
	readonly grams: number;
	readonly amountLabel: string;
	/** False when the portion is the AI's own choice. */
	readonly amountStated?: boolean;
	readonly confidence: "high" | "medium" | "low";
	readonly brand: string | null;
	readonly searchTerms: readonly string[];
	/** What a product is made of; empty for an ingredient. */
	readonly components: readonly Component[];
	/** A product's nutrition for `amount`: the sum of its components. */
	readonly estimate: EstimateNutrients | null;
};

export type Question = {
	readonly text: string;
	readonly options: readonly string[];
};

export type Described = {
	/** Pages a web lookup used; empty without one. */
	readonly sources: readonly Source[];
	readonly kind: "meal" | "label" | "no_food";
	readonly seen: string;
	/** A name for everything together, for saving it as a Personal Food. */
	readonly title: string;
	readonly question: Question | null;
	readonly items: readonly DescribedItem[];
};

export const {
	maxItems: MAX_ITEMS,
	maxText: MAX_TEXT,
	maxFollowUps: MAX_FOLLOW_UPS,
	maxImageBase64: MAX_IMAGE_BASE64,
} = NUTRITION_AI_LIMITS;

const NUTRIENT_NAMES = [
	"energy",
	"protein",
	"carbs",
	"fat",
	"saturatedFat",
	"sugars",
	"fibre",
	"salt",
] as const;

function sumComponents(components: readonly Component[]): EstimateNutrients {
	return Object.fromEntries(
		NUTRIENT_NAMES.map((key) => [
			key,
			components.reduce((total, part) => total + part[key], 0),
		]),
	) as EstimateNutrients;
}

/**
 * A product keeps its components only when every figure is usable; its
 * estimate is their sum, scaled to the item's grams when the two disagree.
 */
function normaliseItem(raw: DescribedItem): DescribedItem {
	const components = (raw.components ?? []).filter(
		(part) =>
			part.name.trim() && part.grams > 0 && validEstimate(part as Component),
	);
	if (raw.kind !== "product" || components.length === 0)
		return {
			...raw,
			kind: "ingredient",
			components: [],
			estimate: null,
			searchTerms: raw.searchTerms.slice(0, 5),
		};
	const total = components.reduce((sum, part) => sum + part.grams, 0);
	const factor = raw.grams / total;
	const scaled = Math.abs(factor - 1) > 0.02;
	const parts = scaled
		? components.map((part) => ({
				...part,
				grams: part.grams * factor,
				...Object.fromEntries(NUTRIENT_NAMES.map((k) => [k, part[k] * factor])),
			}))
		: components;
	return {
		...raw,
		components: parts,
		estimate: sumComponents(parts),
		searchTerms: raw.searchTerms.slice(0, 5),
	};
}

/** The word for frying in the person's text: only then is a fat row invented. */
const FRIED_WORDS = /gebakken|gebraden|roerei|omelet|fried|scrambled/i;
/** A separate frying fat beside a row that was fried in one: "Boter (bakken)". */
const FRYING_FAT_ROW =
	/(?:boter|olie|margarine|butter|oil).*(?:bak|frit|fry)|(?:bak|frit)\S*(?:boter|olie|vet)/i;
const FRIED_ROW = /gebakken|gebraden|\bfried\b/i;
const RAW_QUESTION =
	/\brauw|\braw\b|\bdroog|\bdry\b|ongekookt|uncooked|voor of na|before or after/i;
const STATED_GRAMS = /\d\s*(?:g|gr|gram|kg)\b/i;
const STATED_PREPARATION =
	/gebakken|gebraden|gegrild|gekookt|gefrituurd|gepaneerd|bereid|rauw|fried|grilled|cooked|roasted|breaded|\braw\b/i;
/**
 * Raw or prepared only matters for a stated weight of that food with no
 * preparation said: "100 g rijst en een gebakken ei" still asks about the rice.
 */
function needlessPreparationQuestion(question: string, text: string) {
	if (!RAW_QUESTION.test(question)) return false;
	const asked = new Set(
		question
			.toLowerCase()
			.split(/[^\p{L}]+/u)
			.filter((word) => word.length > 2),
	);
	const clauses = text.split(/[,;]|\s(?:en|met|and|with)\s/i);
	const about = clauses.filter((clause) =>
		clause
			.toLowerCase()
			.split(/[^\p{L}]+/u)
			.some((word) => asked.has(word)),
	);
	return !(about.length ? about : [text]).some(
		(clause) => STATED_GRAMS.test(clause) && !STATED_PREPARATION.test(clause),
	);
}

/** Drinks that really have next to no energy; anything else at 0 kcal is a failed estimate. */
const ENERGY_FREE =
	/\b(?!ijs)\w*(?:water|thee|koffie)\b|\b(?:tea|coffee|bouillon|zero|diet)\b|\b(?:cola|pepsi|fanta|sprite|frisdrank|limonade|soda)\s+light\b/i;
const FAT_NAMED =
	/\w*(?:boter|olie)\b|margarine|bakvet|frituurvet|butter|\boil\b/i;
/** A row that is the fat itself: Roomboter, not Boterham, Pindaboter or "Ei in boter". */
const FAT_ROW =
	/^(?:\S+\s+)?(?!pinda|noten|amandel|cashew)\S*(?:boter|olie|margarine|bakvet|frituurvet|butter|oil)$/i;

export async function describe(
	provider: NutritionAiProvider,
	input: {
		text?: string;
		image?: ImageInput;
		locale: AiLocale;
		/** The previous result as JSON, when refining it. */
		previous?: string;
		/** Corrections and answers, oldest first. */
		followUps?: readonly string[];
		/** Look a named store or brand product up on the web first. */
		webSearch?: boolean;
	},
): Promise<Described> {
	const parts: Part[] = [];
	// A refinement carries the earlier result, which already used the findings.
	const research: ResearchResult =
		input.webSearch &&
		input.text?.trim() &&
		!input.previous &&
		provider.research
			? // A failed lookup still gets an answer: an estimate, marked as one.
				await provider
					.research({ system: RESEARCH_SYSTEM, text: input.text })
					.catch((error: unknown) => {
						console.error("nutritionAi.research failed", error);
						return { notes: "", sources: [] };
					})
			: { notes: "", sources: [] };
	if (input.image) parts.push({ kind: "image", ...input.image });
	parts.push({
		kind: "text",
		text: input.text?.trim() || "What is in this meal?",
	});
	if (research.notes)
		parts.push({
			kind: "text",
			text: `Web findings (published figures, may be partial):\n${research.notes}`,
		});
	if (input.previous && input.followUps?.length)
		parts.push({
			kind: "text",
			text: `Previous result:\n${input.previous}\n\nCorrections, oldest first:\n${input.followUps.map((f) => `- ${f}`).join("\n")}`,
		});
	const raw = (await provider.generate({
		task: "describe",
		system: describeSystem(input.locale),
		parts,
		schema: DESCRIBE_SCHEMA,
	})) as Described;
	// Frying fat nobody mentioned is already in the fried food's figures.
	const unnamedFat =
		!input.previous &&
		!input.image &&
		FRIED_WORDS.test(input.text ?? "") &&
		!FAT_NAMED.test(input.text ?? "");
	const firstLook = !input.previous && !input.image;
	const friedRow =
		firstLook &&
		raw.kind === "meal" &&
		raw.items.some(
			(item) => FRIED_ROW.test(item.name) && !FRYING_FAT_ROW.test(item.name),
		);
	const items = (raw.kind === "meal" ? raw.items : [])
		.filter((item) => !(unnamedFat && FAT_ROW.test(item.name.trim())))
		.filter(
			(item) =>
				!(
					friedRow &&
					FRYING_FAT_ROW.test(item.name) &&
					// A fat they named stays, unless another row of it already counts it.
					(!FAT_NAMED.test(input.text ?? "") ||
						raw.items.some(
							(other) =>
								other !== item &&
								!FRYING_FAT_ROW.test(other.name) &&
								FAT_ROW.test(other.name.trim()),
						))
				),
		)
		.filter((item) => item.amount > 0 && item.grams > 0 && item.name.trim())
		.slice(0, MAX_ITEMS)
		.map(normaliseItem);
	const needless = needlessPreparationQuestion(
		raw.question?.text ?? "",
		[input.text ?? "", ...(input.followUps ?? [])].join(", "),
	);
	const question =
		!needless &&
		raw.question?.text.trim() &&
		(raw.question.options?.length ?? 0) >= 2
			? {
					text: raw.question.text,
					options: raw.question.options.slice(0, 4),
				}
			: null;
	return {
		sources: research.sources,
		kind: raw.kind === "meal" && items.length === 0 ? "no_food" : raw.kind,
		seen: raw.seen,
		title: raw.title?.trim() || items[0]?.name || raw.seen,
		question,
		items,
	};
}

export type SelectInput = {
	readonly name: string;
	readonly product?: boolean;
	readonly amount: number;
	readonly unit: "g" | "ml";
	readonly brand: string | null;
	readonly candidates: readonly {
		readonly ref: string;
		readonly name: string;
	}[];
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
	/** Nothing usable came back: the best-ranked candidate stands in. */
	readonly guess?: boolean;
};

export async function select(
	provider: NutritionAiProvider,
	items: readonly SelectInput[],
): Promise<Choice[]> {
	const listing = items
		.map(
			(item, index) =>
				`Item ${index}${item.product ? " (product)" : ""}: ${item.name} (${item.amount} ${item.unit}${item.brand ? `, brand/store: ${item.brand}` : ""})\n` +
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
		// Zero energy for a real portion is a failed estimate, not a food.
		const usable =
			choice?.estimate &&
			validEstimate(choice.estimate) &&
			!(
				choice.estimate.energy < 1 &&
				item.amount > 20 &&
				!ENERGY_FREE.test(item.name)
			);
		// Figures come per 100: the arithmetic for the portion is ours, not the model's.
		const estimate =
			ref === null && usable && choice?.estimate
				? (Object.fromEntries(
						NUTRIENT_NAMES.map((key) => [
							key,
							((choice.estimate as EstimateNutrients)[key] * item.amount) / 100,
						]),
					) as EstimateNutrients)
				: null;
		// Neither a valid pick nor an estimate: the best-ranked candidate beats
		// a row the person cannot log. A product keeps its own estimate instead.
		const fallback =
			ref === null && estimate === null && !item.product
				? (item.candidates[0]?.ref ?? null)
				: null;
		return {
			index,
			ref: ref ?? fallback,
			estimate,
			...(fallback ? { guess: true } : {}),
		};
	});
}

function validEstimate(estimate: EstimateNutrients): boolean {
	return NUTRIENT_NAMES.map((key) => estimate[key]).every(
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
	/** True when the label showed a barcode whose checksum failed: rescan. */
	readonly barcodeInvalid: boolean;
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
	const barcodeValid = barcode !== null && validEan(barcode);
	return {
		...raw,
		barcode: barcodeValid ? barcode : null,
		barcodeInvalid: barcode !== null && !barcodeValid,
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
