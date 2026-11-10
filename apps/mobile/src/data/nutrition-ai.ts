import {
	formatQuantity,
	type Locale,
	type MealSlot,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	type NutritionDiarySnapshot,
	numericAmount,
	personalFoodServingOptions,
	personalFoodSnapshot,
} from "@foundry/core";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../convex/api";
import {
	type AssistanceFood,
	searchAssistanceFoods,
} from "./nutrition-assistance";
import { oneOffLogSnapshot } from "./nutrition-one-off";
import { typicalPortion } from "./nutrition-portions";
import type { PersonalFoodDraft } from "./personal-food-repository";

/**
 * Hulp bij invoeren: the phone half of AI entry (designs/nutrition/ai-entry_final.html).
 *
 * Convex `nutritionAi.describe` splits text or a photo into items with search
 * terms; this module searches the phone's own food library for each item;
 * `nutritionAi.choose` picks one candidate per item, or estimates the item
 * when nothing fits. Nothing here is saved until the person confirms.
 */

export type Described = FunctionReturnType<typeof api.nutritionAi.describe>;
export type DescribedItem = Described["items"][number];
export type Choice = FunctionReturnType<typeof api.nutritionAi.choose>[number];
export type LabelReading = FunctionReturnType<typeof api.nutritionAi.readLabel>;
export type { ImageInput } from "./nutrition-ai-image";

const CANDIDATES_PER_ITEM = 12;
const COOKED = /\b(gekookte?|bereide?|cooked|boiled)\b/i;
const DRIES =
	/havermout|rijst|pasta|macaroni|spaghetti|noedel|couscous|quinoa|bulgur|gort|bonen|linzen|kikkererwten|oats|porridge|rice|noodle|beans|lentils|chickpeas/i;
const FAT_ITEM =
	/\b(room|bak|braad)?boter\b|\b\w*olie\b|\bmargarine\b|\bbakvet\b|\bbutter\b|\boil\b/i;
/** Words that state a weight or volume, which a counted portion must not override. */
const WEIGHT_IN_WORDS =
	/\d\s*(g|gr|grams?|kg|kilos?|kilograms?|ons|pond|ml|cl|l|liters?)\b/i;
const BREAD_ITEM = /brood|boterham|sneetje|toast|cracker|bread/i;
/** What a food word may end in and still be that food: eieren, plakken, broodjes. */
const WORD_ENDINGS = new Set(
	"en s eren men ken ten pen ren len nen je jes tje tjes".split(" "),
);
const RAW = /\brauwe?\b|\braw\b/i;
const PREPARED =
	/gepaneerde?|gebakken|gebraden|gegrilde?|gekookte?|gefrituurde?|breaded|\bfried\b|grilled|cooked/i;
const ARTICLES = new Set(["de", "het", "een", "the", "a", "an"]);
const WITHOUT = new Set(["zonder", "geen", "without", "no"]);
const NOT = new Set(["niet", "not"]);
const AFFIRMING = new Set(["maar", "wel", "meer", "toch", "but", "more"]);
/** Only a correction that plainly adds something promises to keep the rest. */
const ADDING = new Set(
	"erbij ook nog plus toe toevoegen voeg add also extra".split(" "),
);
/** Removal, in words that need not name the row: "laatste weg", "geen drinken". */
const TAKING_AWAY = new Set(
	"zonder geen niet weg verwijder haal schrap alleen enkel rest behalve without no not remove only just except".split(
		" ",
	),
);
const PLAIN_COOKING = new Set(
	"gebakken gebraden gegrild gegrilde gekookt gekookte bereid bereide geroosterd gestoomd baked grilled cooked roasted fried boiled".split(
		" ",
	),
);
const FILLER_WORDS = new Set(
	"met van de het een en of in op uit aan bij the a an with and or from on".split(
		" ",
	),
);
/** Said as a measure, so the person's number is already the amount. */
const MEASURES = new Set(["g", "gr", "gram", "kg", "ml", "cl", "l", "liter"]);
const FRIED = /gebakken|gefrituurd|\bfried\b/i;
/** Cooked grains and legumes stay under this; their dry forms are near 350. */
const MAX_COOKED_KCAL_PER_100G = 250;
function cookedKcalPer100g(name: string) {
	if (/haver|oats|porridge/i.test(name)) return 70;
	if (/rijst|rice|couscous|bulgur|quinoa|gort/i.test(name)) return 130;
	if (/pasta|macaroni|spaghetti|noedel|noodle/i.test(name)) return 150;
	return 120;
}

export type ReviewComponent = {
	readonly name: string;
	readonly grams: number;
	readonly energy: number;
};

export type ReviewItem = {
	readonly key: string;
	/** The AI's name for what was eaten, shown when nothing matched. */
	readonly described: string;
	/** In `unit`: the matched food's base unit, or the AI's unit for an estimate. */
	readonly amount: number;
	readonly unit: "g" | "ml";
	/** The same amount as a weight; used for foods measured per gram. */
	readonly grams: number;
	/** The same amount as a volume, when the AI described it in ml. */
	readonly ml?: number;
	readonly amountLabel: string;
	readonly confidence: DescribedItem["confidence"];
	/** A ready-made product stays one item, estimated from its components. */
	readonly kind?: DescribedItem["kind"];
	/** What a product is made of, scaled with its amount. */
	readonly components?: readonly ReviewComponent[];
	readonly candidates: readonly AssistanceFood[];
	readonly food?: AssistanceFood;
	/** Nobody said how much, and no known portion or serving settled it. */
	readonly portionGuessed?: boolean;
	/** The person set the values by hand: a refinement never replaces them. */
	readonly edited?: boolean;
	/** Totals for `amount` when no food matched; always an estimate. */
	readonly estimate?: Readonly<Record<NutrientKey, NutrientValue>>;
};

function nutrientValues(
	estimate: NonNullable<DescribedItem["estimate"]>,
): Record<NutrientKey, NutrientValue> {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [key, { kind: "value", amount: estimate[key] }]),
	) as Record<NutrientKey, NutrientValue>;
}

/**
 * Local candidates per item: every search term against the shipped and
 * personal library, best rank first. Foods measured per serving are left out
 * because the AI estimates grams or millilitres, and foods measured per ml
 * need an amount described as a volume: weight never silently becomes volume.
 * A named store or brand product only matches a Personal Food (the same product
 * saved earlier): a shipped ingredient is never a proxy for a whole sandwich.
 * A cooked grain or legume never gets a food as energy-dense as its dry form:
 * cooked weight times dry oats is three times too much. With its fat as a row
 * of its own, a food never gets a fried variant, which contains that fat.
 */
export function groundItems(
	items: readonly DescribedItem[],
	catalog: readonly AssistanceFood[],
	locale: Locale,
): ReviewItem[] {
	// Butter beside bread is a spread: it says nothing about how the rest was made.
	const fatListed =
		items.some((item) => FAT_ITEM.test(item.name)) &&
		!items.some((item) => BREAD_ITEM.test(item.name));
	const namesOf = (index: number) =>
		items.flatMap((other, at) => (at === index ? [] : wordsOf(other.name)));
	return items.map((item, index) => {
		const others = namesOf(index);
		// "Kipfilet gepaneerd" is not the raw product, which has half the energy.
		const preparedRow = PREPARED.test(item.name) && !RAW.test(item.name);
		const cooked = COOKED.test(item.name) && DRIES.test(item.name);
		const dry = DRY.test(item.name) && DRIES.test(item.name);
		const noFried = fatListed && !FAT_ITEM.test(item.name);
		const ranked = new Map<string, { food: AssistanceFood; rank: number }>();
		// The plain name finds the database's prepared food: "Kipfilet gebakken"
		// searched as written misses "Kipfilet (bereid)".
		const plainName = wordsOf(item.name)
			.filter((word) => !PLAIN_COOKING.has(word))
			.join(" ");
		for (const term of [...item.searchTerms, item.name, plainName]) {
			searchAssistanceFoods(term, catalog, locale, 8).forEach((food, rank) => {
				if (food.baseUnit === "serving") return;
				if (item.kind === "product" && item.brand && food.kind !== "personal")
					return;
				if (noFried && FRIED.test(foodWords(food))) return;
				if (preparedRow && RAW.test(foodWords(food))) return;
				if (containsAnother(food, others)) return;
				const energy = food.nutrients.energy;
				if (
					cooked &&
					energy.kind === "value" &&
					energy.amount > MAX_COOKED_KCAL_PER_100G
				)
					return;
				if (
					dry &&
					energy.kind === "value" &&
					energy.amount < MIN_DRY_KCAL_PER_100G
				)
					return;
				if (food.baseUnit === "ml" && item.unit !== "ml") return;
				const prior = ranked.get(food.id);
				if (!prior || prior.rank > rank) ranked.set(food.id, { food, rank });
			});
		}
		const row: ReviewItem = {
			key: `item-${index}`,
			described: item.name,
			amount: item.amount,
			unit: item.unit,
			grams: item.grams,
			...(item.unit === "ml" ? { ml: item.amount } : {}),
			amountLabel: item.amountLabel,
			confidence: item.confidence,
			kind: item.kind,
			...(item.kind === "product" && item.estimate
				? {
						estimate: nutrientValues(item.estimate),
						components: item.components.map((part) => ({
							name: part.name,
							grams: part.grams,
							energy: part.energy,
						})),
					}
				: {}),
			candidates: [...ranked.values()]
				.sort((a, b) => a.rank - b.rank)
				.slice(0, CANDIDATES_PER_ITEM)
				.map((entry) => entry.food),
		};
		return withTypicalPortion(row, item, locale);
	});
}

/**
 * The AI interprets; a known portion decides the grams. A weight or size the
 * person gave stays, and a product's figures follow the portion.
 */
function withTypicalPortion(
	row: ReviewItem,
	item: DescribedItem,
	locale: Locale,
): ReviewItem {
	const guessed = item.amountStated === false;
	const count = countedPortion(row);
	// A row the AI kept on a correction carries that correction's amount.
	const candidate =
		!item.id &&
		!item.brand &&
		row.unit === "g" &&
		(guessed || count) &&
		!SIZE_WORD.test(`${row.described} ${row.amountLabel}`)
			? typicalPortion(row.described, row.amountLabel)
			: undefined;
	const portion =
		candidate && (candidate.counts || !PART_OF_FOOD.test(row.amountLabel))
			? candidate
			: undefined;
	if (!portion) return guessed ? { ...row, portionGuessed: true } : row;
	const pieces = count ?? 1;
	const sized = withAmount(row, pieces * portion.grams, locale);
	const label = WEIGHT_IN_WORDS.test(row.amountLabel)
		? sized.amountLabel
		: row.amountLabel;
	const energy = energyOf(sized);
	if (!portion.kcal || !sized.estimate || !energy)
		return { ...sized, amountLabel: label };
	const factor = (pieces * portion.kcal) / energy;
	return {
		...sized,
		amountLabel: label,
		estimate: scale(sized.estimate, factor),
		...(sized.components
			? {
					components: sized.components.map((part) => ({
						...part,
						energy: part.energy * factor,
					})),
				}
			: {}),
	};
}

/** "Bereid m halfvolle melk" beside a row of milk would count the milk twice. */
function containsAnother(food: AssistanceFood, others: readonly string[]) {
	const made = foodWords(food).match(/\b(?:m|met|with)\s+([\p{L}\s-]+)/iu)?.[1];
	if (!made || !others.length) return false;
	return wordsOf(made).some((word) =>
		others.some((other) => sameFoodWord(word, other)),
	);
}

function foodWords(food: AssistanceFood) {
	const published =
		food.provenance.source === "shipped"
			? food.provenance.sourceName
			: undefined;
	return [food.name.nl, food.name.en, published?.nl, published?.en].join(" ");
}

/**
 * "3 plakken" of a food with a known slice is three of those slices, whatever
 * the AI guessed: the same words give the same grams.
 */
function snapToServing(item: ReviewItem, locale: Locale): ReviewItem {
	const food = item.food;
	const count = countedPortion(item);
	const word = item.amountLabel.trim().match(/^\d+\s+(\p{L}+)/u)?.[1];
	if (!food?.servings?.length || food.baseUnit !== "g" || !count || !word)
		return item;
	const said = word.toLowerCase();
	const serving = food.servings.find((option) => {
		// "Plak" or "1 stuk (58 g)" is one of something; "Twee eieren" is not.
		// The person's words are in their own language, not always in Dutch.
		return [option.label.nl, option.label.en].some((text) => {
			const label = text.toLowerCase().replace(/^1\s+/, "");
			if (/^(twee|drie|vier|two|three|four|\d)/.test(label)) return false;
			const noun = label.match(/^\p{L}+/u)?.[0];
			return (
				noun !== undefined && (said.startsWith(noun) || noun.startsWith(said))
			);
		});
	});
	if (!serving) return item;
	return {
		...withAmount(item, count * serving.amount, locale),
		amountLabel: item.amountLabel,
		confidence: item.confidence,
		portionGuessed: false,
	};
}

/** How many of something the label counts: 3 for "3 eieren", none for "200 ml" or "1 portie (30 g)". */
export function countedPortion(item: ReviewItem): number | undefined {
	const words = item.amountLabel.trim();
	if (WEIGHT_IN_WORDS.test(words)) return undefined;
	const said = words.match(/^(\d+)\s+(\p{L}+)/u);
	const count = Number(said?.[1]);
	return said &&
		!MEASURES.has((said[2] as string).toLowerCase()) &&
		count >= 1 &&
		count <= 20
		? count
		: undefined;
}

function wordsOf(text: string): string[] {
	return text
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);
}

/** Tomaat and tomaten, boon and bonen: Dutch spelling doubles the vowel. */
const singleVowels = (word: string) => word.replace(/([aeou])\1/g, "$1");

/** Plural or small form of one food word, or its head in a compound: Roomboter is boter, Pindakaas is not kaas. */
function sameFoodWord(a: string, b: string): boolean {
	if (a === b) return true;
	const [x, y] = [singleVowels(a), singleVowels(b)];
	const [short, long] = x.length < y.length ? [x, y] : [y, x];
	if (short === long) return true;
	if (long.startsWith(short) && WORD_ENDINGS.has(long.slice(short.length)))
		return true;
	return (
		short.length >= 4 &&
		short.length / long.length >= 0.55 &&
		long.endsWith(short)
	);
}

/**
 * Whether a correction asks for this food, by one of its words. "Zonder boter"
 * does not ask for butter, and a unit like "g" never names anything.
 */
export function asksFor(correction: string, names: readonly string[]): boolean {
	const wanted = names
		.flatMap(wordsOf)
		.filter(
			(word) =>
				!FILLER_WORDS.has(word) && !MEASURES.has(word) && !/^\d/.test(word),
		);
	// "Zonder ui en kaas" and "zonder extra kaas" take the cheese out; a comma or
	// "maar wel" ends it: "zonder ui, kaas erbij". "Niet" is about the next word
	// only, so "niet zo veel kaas" is still about the cheese.
	return correction.split(/[,;]/).some((clause) => {
		const said = wordsOf(clause);
		let without = false;
		return said.some((word, index) => {
			if (WITHOUT.has(word)) without = true;
			else if (AFFIRMING.has(word)) without = false;
			const before = said[index - 1] ?? "";
			const not =
				NOT.has(before) ||
				(ARTICLES.has(before) && NOT.has(said[index - 2] ?? ""));
			return (
				!without && !not && wanted.some((name) => sameFoodWord(name, word))
			);
		});
	});
}

/** The review's "~": where the number came from, not how sure the AI sounded. */
export function isUncertain(item: ReviewItem): boolean {
	return (
		!item.food ||
		item.confidence === "low" ||
		(Boolean(item.portionGuessed) && !item.edited)
	);
}

/** What "geen saus" takes away, also when it has no row of its own. */
export function removedInWords(correction: string): DeletedRow[] {
	return correction.split(/[,;]/).flatMap((clause) => {
		const said = wordsOf(clause);
		const from = said.findIndex((word) => WITHOUT.has(word));
		if (from < 0) return [];
		const rest = said.slice(from + 1);
		const end = rest.findIndex((word) => AFFIRMING.has(word));
		return (end < 0 ? rest : rest.slice(0, end))
			.filter((word) => !FILLER_WORDS.has(word) && !ARTICLES.has(word))
			.map((name) => ({ name, searchTerms: [] }));
	});
}

/** "Geen idee" takes nothing away. */
const NOT_A_FOOD = new Set([
	"idee",
	"idea",
	"probleem",
	"problem",
	"zorgen",
	"clue",
]);

/** A correction that asked for a food to go, so unchanged numbers mean it failed. */
export function asksToRemove(correction: string): boolean {
	const removed = removedInWords(correction);
	return removed.length > 0 && !removed.some((row) => NOT_A_FOOD.has(row.name));
}

export type DeletedRow = {
	readonly name: string;
	readonly searchTerms: readonly string[];
};

const MAX_SURE_ESTIMATE_KCAL = 800;
/** A match this far from the product's own estimate is another dish. */
const MAX_MATCH_DISAGREEMENT = 1.5;
const SIZE_WORD =
	/\b(?:klein|kleine|kleintje|groot|grote|flinke?|ruime?|medium|mini|halve?|dubbele?|small|large|big|double)\b/i;
/** Counted parts or measures of a food, which say nothing about one whole piece. */
const PART_OF_FOOD =
	/schijf|schijven|plak|part|lepel|snee|sneden|sneetje|fles|glas|glazen|beker|kop|blik|bakje|kom|stukje|doos|\bdozen\b|\b(?:hap|pak|zak)(?:je|jes)?\b|\b(?:happen|pakken|zakken)\b/i;
const DRY = /\b(?:droog|droge|ongekookte?|dry|uncooked)\b/i;
/** Dry grains and legumes stay above this; cooked ones stay below. */
const MIN_DRY_KCAL_PER_100G = 200;

const WHOLE_MEAL =
	/\b(?:halve|dubbele|half|double)\s+(?:portie|maaltijd|bord|portion|meal|plate)\b|\bde helft\b(?!\s+van)|\bhalf of it\b/iu;

const PREPARATION =
	/\b(?:ongekookt|uncooked|droog|dry|rauw|raw|gekookt|gegaard|cooked|boiled|gebakken|fried|gegrild|grilled|gestoomd|steamed|gefrituurd|gepocheerd|poached)/giu;

function preparationsIn(text: string): Set<string> {
	return new Set(text.toLowerCase().match(PREPARATION) ?? []);
}

function preparationChanged(before: string, after: string): boolean {
	const was = preparationsIn(before);
	const now = preparationsIn(after);
	return (
		was.size > 0 && now.size > 0 && ![...now].some((word) => was.has(word))
	);
}

/**
 * The AI's own words, when the matched food is prepared another way: a fried
 * egg counted as a boiled one, its fat on a row of its own, still says fried.
 */
export function preparationCaption(
	item: ReviewItem,
	locale: Locale,
): string | undefined {
	const food = item.food?.name[locale];
	return food && preparationChanged(food, item.described)
		? item.described
		: undefined;
}

/**
 * What the AI wrote about the whole meal stops being true once a food in it
 * is gone. The rows are the truth then. A title without that food still holds.
 */
export function sentenceWithoutRemoved(
	sentence: { readonly seen: string; readonly title?: string },
	removed: readonly DeletedRow[],
	remaining: readonly string[],
): { seen: string; title: string } {
	const stale = (text: string) =>
		removed.some((row) => {
			const words = [row.name, ...row.searchTerms];
			return (
				asksFor(text, words) && !remaining.some((name) => asksFor(name, words))
			);
		});
	return {
		seen: stale(sentence.seen) ? remaining.join(", ") : sentence.seen,
		title: sentence.title && !stale(sentence.title) ? sentence.title : "",
	};
}

/** A row the person deleted, under its own name or one the AI gave it again. */
export function isDeletedRow(
	item: DeletedRow,
	deleted: readonly DeletedRow[],
): boolean {
	const name = wordsOf(item.name).join(" ");
	// "Tosti met kaas" is a tosti: what follows "met" does not make it cheese.
	const all = wordsOf(item.name);
	const stop = all.findIndex((word) => FILLER_WORDS.has(word));
	const head = stop > 0 ? all.slice(0, stop) : all;
	return deleted.some((row) => {
		const noun =
			wordsOf(row.searchTerms[0] ?? "")[0] ?? wordsOf(row.name).pop() ?? "";
		return (
			name === wordsOf(row.name).join(" ") ||
			head.some((word) => sameFoodWord(word, noun)) ||
			(row.searchTerms[0] !== undefined &&
				row.searchTerms[0] === item.searchTerms[0])
		);
	});
}

/** The current review as the AI should read it: edits in, deleted rows out. */
export function currentDescription(
	rows: readonly ReviewItem[],
	source: readonly DescribedItem[],
): DescribedItem[] {
	return rows.flatMap((row) => {
		const item = source.find((entry) => entry.name === row.described);
		if (!item) return [];
		const factor = row.grams / item.grams;
		// What the person sees, which a known portion or an edit may have changed.
		const onScreen = row.estimate ?? (item.estimate && itemNutrients(row));
		const shown = onScreen ? numbers(onScreen) : undefined;
		const figures =
			shown && item.estimate?.energy
				? shown.energy / item.estimate.energy
				: factor;
		return [
			{
				...item,
				id: row.key,
				amount: row.ml ?? (row.food ? row.amount : item.amount * factor),
				grams: row.grams,
				amountLabel: row.amountLabel,
				components: item.components.map((part) => ({
					...part,
					...scaleNumbers(part, figures),
					grams: part.grams * factor,
				})),
				estimate:
					shown ??
					(item.estimate ? scaleNumbers(item.estimate, factor) : item.estimate),
			},
		];
	});
}

type EstimateFigures = NonNullable<DescribedItem["estimate"]>;

function scaleNumbers(
	figures: EstimateFigures,
	factor: number,
): EstimateFigures {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [key, figures[key] * factor]),
	) as EstimateFigures;
}

function numbers(
	nutrients: Readonly<Record<NutrientKey, NutrientValue>>,
): EstimateFigures {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [key, numericAmount(nutrients[key]) ?? 0]),
	) as EstimateFigures;
}

/**
 * After a correction, rows the correction did not touch stay as they were: the
 * same food, or the values set by hand. Only other rows go back to the AI.
 */
export function carryOver(
	grounded: readonly ReviewItem[],
	described: readonly DescribedItem[],
	prior: readonly ReviewItem[],
	priorDescribed: readonly DescribedItem[],
	locale: Locale,
	correction = "",
): (ReviewItem | undefined)[] {
	const pool = [...prior];
	const wordsFor = (row: ReviewItem) => [
		row.described,
		row.amountLabel,
		...(priorDescribed.find((item) => item.name === row.described)
			?.searchTerms ?? []),
		...(row.food ? [row.food.name.nl, row.food.name.en] : []),
	];
	// One row in, one row out: whatever was said was about it.
	const only =
		Boolean(correction.trim()) &&
		prior.length === 1 &&
		described.length === 1 &&
		!prior[0]?.food;
	const said = prior.filter((row) => asksFor(correction, wordsFor(row)));
	// "Halve portie" is about every row, also one set by hand, unless it names one.
	// A row labelled "1 portie" is not what "halve portie" names.
	const wholeMeal =
		WHOLE_MEAL.test(correction) &&
		!prior.some((row) =>
			asksFor(
				correction,
				wordsFor(row).filter((word) => word !== row.amountLabel),
			),
		);
	const named = new Set(only || wholeMeal ? prior : said);
	const wholeMealFactor = /dubbel|double/i.test(correction) ? 2 : 0.5;
	// The correction is about something else: this row has no reason to move.
	const removal = wordsOf(correction).some((word) => WITHOUT.has(word));
	const aboutOther =
		named.size > 0 ||
		described.some(
			(item) =>
				!item.id &&
				!prior.some((row) => row.described === item.name) &&
				asksFor(correction, [item.name, ...item.searchTerms]),
		);
	return grounded.map((next, index) => {
		// The row the AI says this is, whatever it calls it now.
		const id = described[index]?.id;
		const byId = id ? pool.findIndex((row) => row.key === id) : -1;
		const at =
			byId >= 0
				? byId
				: pool.findIndex((row) => row.described === next.described);
		const row = pool[at];
		if (!row || !(row.food || row.edited || row.estimate)) return undefined;
		const before = priorDescribed.find((item) => item.name === row.described);
		// "Rauw" to "gegaard" is another food even under the same search words.
		const newFood =
			JSON.stringify(before?.searchTerms) !==
				JSON.stringify(described[index]?.searchTerms) ||
			preparationChanged(row.described, next.described);
		// "Kip in plaats van ham": another food now, hand-set or not.
		if (
			row.edited &&
			newFood &&
			asksFor(correction, [
				next.described,
				...(described[index]?.searchTerms ?? []),
			])
		)
			return undefined;
		// What the person set by hand stays, unless this correction is about it.
		// Another row being named does not explain a changed count: "3 boterhammen
		// en dubbel kaas" names the cheese and still changes the bread.
		// Taking one food away leaves a row alone unless the row itself changed:
		// "geen saus" gives a sandwich other parts, or a dish another food.
		// A name may only gain words: "Kaas" as "Goudse kaas" is the same cheese,
		// "Friet met mayo" as "Friet" has lost its sauce. Components are compared with
		// the AI's own last list, because a matched row no longer carries any.
		const nextName = wordsOf(next.described);
		const untouched =
			!removal ||
			(!newFood &&
				wordsOf(row.described).every((word) => nextName.includes(word)) &&
				componentNames(before ?? row) ===
					componentNames(described[index] ?? next));
		const nextLabel = described[index]?.amountLabel ?? "";
		// On a removal a new amount counts only if the person said it.
		const amountMoved = removal
			? saysAmount(nextLabel, correction) &&
				countChanged(row.amountLabel, nextLabel, correction)
			: countChanged(row.amountLabel, nextLabel, correction);
		if (
			!named.has(row) &&
			(row.edited || ((aboutOther || removal) && untouched && !amountMoved))
		) {
			pool.splice(at, 1);
			return { ...row, key: next.key, described: next.described };
		}
		// Half of what is on screen, whatever figure the AI comes back with.
		if (wholeMeal) {
			pool.splice(at, 1);
			return {
				...withAmount(row, row.amount * wholeMealFactor, locale),
				key: next.key,
				described: next.described,
				amountLabel: next.amountLabel,
			};
		}
		// An estimate has no food to scale: the AI's new one is the answer.
		if (!row.food && row.edited && row.kind === "product") return undefined;
		// An estimated product comes back re-estimated: within noise, it did not
		// change, and the person should not see its number move.
		if (!row.food && !row.edited && row.kind === "product") {
			const energyBefore = energyOf(row);
			const energyAfter = energyOf(next);
			if (
				!energyBefore ||
				!energyAfter ||
				Math.abs(energyAfter / energyBefore - 1) > 0.05 ||
				Math.abs(next.grams / row.grams - 1) >= 0.02 ||
				componentNames(row) !== componentNames(next)
			)
				return undefined;
			pool.splice(at, 1);
			return { ...row, key: next.key, described: next.described };
		}
		if (newFood && !row.edited) return undefined;
		pool.splice(at, 1);
		const factor = next.grams / row.grams;
		const sized =
			Math.abs(factor - 1) < 0.02
				? row
				: withAmount(row, row.amount * factor, locale);
		const corrected = {
			...sized,
			key: next.key,
			described: next.described,
			amountLabel: next.amountLabel,
			confidence: next.confidence,
			portionGuessed: Boolean(next.portionGuessed),
		};
		// "4 eieren" weighs what four of them weigh, as on a first pass.
		return countedPortion(row) !== countedPortion(corrected)
			? snapToServing(corrected, locale)
			: corrected;
	});
}

/**
 * A real change: the same measure with another number, or a number the person
 * said. "2 sneetjes" coming back as "90 g" is the AI rephrasing an untouched row.
 */
function countChanged(before: string, after: string, correction: string) {
	const read = (label: string) =>
		label.match(/(\d+(?:[.,]\d+)?)\s*(\p{L}*)/u)?.slice(1) ?? [];
	const [number, measure] = read(before);
	const [nextNumber, nextMeasure] = read(after);
	if (!nextNumber || number === nextNumber) return false;
	return measure === nextMeasure || saysAmount(after, correction);
}

const NUMBER_WORDS: Readonly<Record<string, readonly string[]>> = {
	"1": ["een", "één", "one"],
	"2": ["twee", "two"],
	"3": ["drie", "three"],
	"4": ["vier", "four"],
	"5": ["vijf", "five"],
	"6": ["zes", "six"],
};

/** "70g", "2" and "twee" all say the amount; words of a food do not. */
function saysAmount(label: string, correction: string) {
	const amount = label.match(/\d+(?:[.,]\d+)?/)?.[0];
	if (amount === undefined) return false;
	const said = correction.toLowerCase();
	return (
		[...said.matchAll(/\d+(?:[.,]\d+)?/g)].some((m) => m[0] === amount) ||
		(NUMBER_WORDS[amount] ?? []).some((word) =>
			said.split(/[^\p{L}]+/u).includes(word),
		)
	);
}

const componentNames = (item: {
	readonly components?: readonly { readonly name: string }[];
}) =>
	(item.components ?? [])
		.map((part) => part.name.toLowerCase())
		.sort()
		.join("|");

/**
 * A row the AI left out of a correction that only adds comes back, so "add a
 * glass of water" cannot lose the broccoli, and so does a hand-edited row after
 * any correction not about it. Otherwise rows may go on purpose: "geen saus",
 * "het was een tosti", "alleen de kip".
 */
export function withOmittedRows(
	described: readonly DescribedItem[],
	prior: readonly ReviewItem[],
	priorDescribed: readonly DescribedItem[],
	correction = "",
): DescribedItem[] {
	const said = wordsOf(correction);
	const returned = (row: ReviewItem) =>
		described.some(
			(item) => item.id === row.key || item.name === row.described,
		);
	const adding =
		said[0] === "en" ||
		said[0] === "and" ||
		said.some((word) => ADDING.has(word));
	const takingAway = said.some((word) => TAKING_AWAY.has(word));
	// "Laatste weg" may mean any row; "geen saus" says which food it is about.
	if (
		(takingAway && !removedInWords(correction).length) ||
		!prior.some(returned)
	)
		return [...described];
	const left = prior.filter((row) => {
		// What the person set by hand never goes silently, whatever else was said.
		if (returned(row) || !((adding && !takingAway) || row.edited)) return false;
		const source = priorDescribed.find((item) => item.name === row.described);
		const names = [row.described, ...(source?.searchTerms ?? [])]
			.flatMap(wordsOf)
			.filter((word) => !FILLER_WORDS.has(word));
		// Named at all, also in "geen broccoli": its absence was asked for.
		return !said.some((word) => names.some((name) => sameFoodWord(name, word)));
	});
	return [...described, ...currentDescription(left, priorDescribed)];
}

function energyOf(item: ReviewItem) {
	const energy = item.estimate?.energy;
	return energy?.kind === "value" ? energy.amount : undefined;
}

/** Shipped foods are offered by their published name, which carries preparation. */
function candidateName(food: AssistanceFood): string {
	if (food.provenance.source === "shipped") {
		const published = food.provenance.sourceName?.nl;
		if (published && published !== food.name.nl)
			return `${food.name.nl} (${published})`;
	}
	return food.name.nl;
}

export function chooseInput(
	items: readonly ReviewItem[],
	brands: readonly (string | null)[],
) {
	return items.map((item, index) => ({
		name: item.described,
		amount: item.amount,
		unit: item.unit,
		brand: brands[index] ?? null,
		...(item.kind === "product" ? { product: true } : {}),
		candidates: item.candidates.map((food) => ({
			ref: food.id,
			name: candidateName(food),
		})),
	}));
}

export function applyChoices(
	items: readonly ReviewItem[],
	choices: readonly Choice[],
	locale: Locale = "nl",
): ReviewItem[] {
	return items.map((item, index) => {
		const choice = choices.find((c) => c.index === index);
		// The database has this food as prepared: its figures beat a guess at them.
		const prepared =
			choice && !choice.ref && item.kind !== "product"
				? preparedCandidate(item)
				: undefined;
		const food = item.candidates.find((c) => c.id === choice?.ref) ?? prepared;
		if (food) {
			const matched = snapToServing(replaceFood(item, food), locale);
			// A product's own estimate far from the match: another dish with a
			// similar name. The estimate stays, and says it is unsure.
			const own = energyOf(item);
			const found = reviewTotals([matched]).energy.amount;
			const sameDish = isSameDish(item, food);
			if (
				item.kind === "product" &&
				food.kind !== "personal" &&
				!sameDish &&
				own &&
				found &&
				Math.max(own / found, found / own) > MAX_MATCH_DISAGREEMENT
			)
				return { ...item, confidence: "low" };
			// The server fell back on the best-ranked food: say it is a guess.
			return choice?.guess ? { ...matched, confidence: "low" } : matched;
		}
		// A product keeps the estimate built from its components.
		if (item.kind === "product") return item;
		const estimate = choice?.estimate;
		if (!estimate) return item;
		// Figures of the dry food on a cooked weight: three times too much. What is
		// known about the cooked food replaces them, marked as a guess.
		const perHundred = (estimate.energy / item.amount) * 100;
		if (
			COOKED.test(item.described) &&
			DRIES.test(item.described) &&
			perHundred > MAX_COOKED_KCAL_PER_100G
		)
			return {
				...item,
				confidence: "low",
				estimate: nutrientValues(
					scaleNumbers(
						estimate,
						cookedKcalPer100g(item.described) / perHundred,
					) as typeof estimate,
				),
			};
		// Cooked figures on a dry weight: three times too little.
		if (
			DRY.test(item.described) &&
			DRIES.test(item.described) &&
			perHundred > 0 &&
			perHundred < MIN_DRY_KCAL_PER_100G
		)
			return {
				...item,
				confidence: "low",
				estimate: nutrientValues(
					Object.fromEntries(
						Object.entries(estimate).map(([key, value]) => [
							key,
							(value * 350) / perHundred,
						]),
					) as typeof estimate,
				),
			};
		// More than a whole meal in one estimated ingredient is rarely true: it
		// keeps its number, and says it is unsure.
		return {
			...item,
			...(estimate.energy > MAX_SURE_ESTIMATE_KCAL
				? { confidence: "low" as const }
				: {}),
			estimate: nutrientValues(estimate),
		};
	});
}

/**
 * Plain "Erwtensoep" and the database's "Erwtensoep met vlees" are one dish, far
 * apart or not. "Hutspot met klapstuk" is not plain "Hutspot", and a hamburger
 * with a known portion is not the 80 g patty of the same name.
 */
function isSameDish(item: ReviewItem, food: AssistanceFood) {
	const foodNames = wordsOf(food.name.nl);
	const words = wordsOf(item.described).filter(
		(word) => !FILLER_WORDS.has(word) && !ARTICLES.has(word),
	);
	if (!sameFoodWord(foodNames[0] ?? "", words[0] ?? "")) return false;
	if (typicalPortion(item.described, item.amountLabel)?.kcal) return false;
	// Every word of the dish is in the food: "Pasta carbonara" is not "Pasta (bereid)".
	return words.every((word) =>
		foodNames.some((name) => sameFoodWord(name, word)),
	);
}

/** "Kipfilet gebakken" and the database's "Kipfilet (bereid)": the same food. */
function preparedCandidate(item: ReviewItem) {
	// One food word and plain cooking: "Kipfilet gepaneerd", "Kipfilet rauw" and
	// "Kipfilet in roomsaus" are not the database's plain prepared chicken.
	const names = wordsOf(item.described).filter(
		(word) => !PLAIN_COOKING.has(word),
	);
	const head = names[0];
	if (!head || names.length > 1) return undefined;
	return item.candidates.find((food) => {
		const words = foodWords(food);
		const first = wordsOf(food.name.nl)[0];
		return (
			first !== undefined &&
			sameFoodWord(head, first) &&
			/\bbereid\b/i.test(words) &&
			!/\b(?:m|met|with)\s/i.test(words)
		);
	});
}

/** A matched food counts in its own base unit: grams, or ml when known. */
export function replaceFood(
	item: ReviewItem,
	food: AssistanceFood,
): ReviewItem {
	// Food figures replace the estimate, and whatever it was built from.
	const {
		estimate: _estimate,
		components: _components,
		edited: _edited,
		...rest
	} = item;
	const perMl = food.baseUnit === "ml" && item.ml !== undefined;
	return {
		...rest,
		food,
		unit: perMl ? "ml" : "g",
		amount: perMl ? (item.ml as number) : item.grams,
	};
}

/**
 * A new amount rescales an estimate proportionally; a matched food is
 * recomputed from its own figures.
 */
export function withAmount(
	item: ReviewItem,
	amount: number,
	locale: Locale,
): ReviewItem {
	if (!(amount > 0) || amount === item.amount) return item;
	const factor = amount / item.amount;
	const estimate = item.estimate ? scale(item.estimate, factor) : undefined;
	return {
		...item,
		amount,
		grams: item.grams * factor,
		...(item.ml !== undefined ? { ml: item.ml * factor } : {}),
		amountLabel: `${formatQuantity(amount, locale)} ${item.unit}`,
		...(estimate ? { estimate } : {}),
		...(item.components
			? {
					components: item.components.map((part) => ({
						...part,
						grams: part.grams * factor,
						energy: part.energy * factor,
					})),
				}
			: {}),
	};
}

function scale(
	nutrients: Readonly<Record<NutrientKey, NutrientValue>>,
	factor: number,
): Record<NutrientKey, NutrientValue> {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => {
			const value = nutrients[key];
			return [
				key,
				value.kind === "value"
					? { kind: "value", amount: value.amount * factor }
					: value,
			];
		}),
	) as Record<NutrientKey, NutrientValue>;
}

/** Totals for the item's amount, or undefined when it has neither food nor estimate. */
export function itemNutrients(
	item: ReviewItem,
): Readonly<Record<NutrientKey, NutrientValue>> | undefined {
	if (item.food) return scale(item.food.nutrients, item.amount / 100);
	return item.estimate;
}

/** A total and whether any item lacked that figure (unknown is never zero). */
export type ReviewTotal = {
	readonly amount: number;
	readonly known: number;
	readonly missing: boolean;
};
export type ReviewTotals = Readonly<
	Record<"energy" | "protein" | "carbs" | "fat", ReviewTotal>
>;

export function reviewTotals(items: readonly ReviewItem[]): ReviewTotals {
	const keys = ["energy", "protein", "carbs", "fat"] as const;
	const totals = Object.fromEntries(
		keys.map((key) => [key, { amount: 0, known: 0, missing: false }]),
	) as Record<
		(typeof keys)[number],
		{ amount: number; known: number; missing: boolean }
	>;
	for (const item of items) {
		const nutrients = itemNutrients(item);
		for (const key of keys) {
			const amount = nutrients ? numericAmount(nutrients[key]) : undefined;
			if (amount === undefined) totals[key].missing = true;
			else {
				totals[key].amount += amount;
				totals[key].known += 1;
			}
		}
	}
	return totals;
}

export function readyToLog(items: readonly ReviewItem[]): boolean {
	return items.length > 0 && items.every((item) => itemNutrients(item));
}

/** What the diary shows: the person's own words with the weight they mean. */
function servingLabel(
	item: ReviewItem,
	locale: Locale,
	unit: "g" | "ml" = item.unit,
) {
	const measured = `${formatQuantity(Math.round(item.amount), locale)} ${unit}`;
	const words = item.amountLabel.trim();
	if (!words) return measured;
	// "200 ml" of milk stays what they said, though the diary counts it in grams.
	return WEIGHT_IN_WORDS.test(words) ? words : `${words} (${measured})`;
}

/** The review's own "~": a matched food at a portion the AI was sure of is not a guess. */
function guessed(item: ReviewItem) {
	return item.confidence === "low" || (item.portionGuessed && !item.edited)
		? { estimated: true as const }
		: {};
}

function unitOf(food: AssistanceFood): "g" | "ml" {
	return food.baseUnit === "ml" ? "ml" : "g";
}

/** One estimated Diary Entry per item; matched items keep their Food Reference. */
export function diarySnapshots(
	items: readonly ReviewItem[],
	date: string,
	meal: MealSlot,
): NutritionDiarySnapshot[] {
	return items.map((item) => {
		const food = item.food;
		if (!food) {
			if (!item.estimate)
				throw new Error("Every item needs a food or estimate.");
			return {
				...oneOffLogSnapshot({
					date,
					meal,
					name: { en: item.described, nl: item.described },
					amount: item.amount,
					baseUnit: item.unit,
					nutrients: item.estimate,
				}),
				serving: {
					en: servingLabel(item, "en"),
					nl: servingLabel(item, "nl"),
				},
			};
		}
		if (food.personalFood) {
			const base = personalFoodServingOptions(food.personalFood).find(
				(option) => option.kind === "base-unit",
			);
			return {
				...personalFoodSnapshot(food.personalFood, {
					quantity: item.amount,
					serving: base,
					date,
					meal,
				}),
				serving: {
					en: servingLabel(item, "en", unitOf(food)),
					nl: servingLabel(item, "nl", unitOf(food)),
				},
				...guessed(item),
			};
		}
		const unit = food.baseUnit === "ml" ? "ml" : "g";
		return {
			date,
			meal,
			name: food.name,
			serving: {
				en: servingLabel(item, "en", unit),
				nl: servingLabel(item, "nl", unit),
			},
			quantity: item.amount,
			amount: item.amount,
			baseUnit: unit,
			nutrients: scale(food.nutrients, item.amount / 100),
			provenance: food.provenance,
			...guessed(item),
		};
	});
}

/** Everything as one Diary Entry, for Opslaan als → Eén item. */
export function oneEntrySnapshot(
	items: readonly ReviewItem[],
	name: string,
	date: string,
	meal: MealSlot,
): NutritionDiarySnapshot {
	const [only] = items;
	const drink = items.length === 1 && only?.unit === "ml";
	const entry = oneOffLogSnapshot({
		date,
		meal,
		name: { en: name, nl: name },
		amount: drink
			? only.amount
			: items.reduce((total, item) => total + item.grams, 0),
		baseUnit: drink ? "ml" : "g",
		nutrients: combinedNutrients(items),
	});
	if (only && items.length === 1)
		return {
			...entry,
			serving: {
				en: servingLabel(only, "en", entry.baseUnit as "g" | "ml"),
				nl: servingLabel(only, "nl", entry.baseUnit as "g" | "ml"),
			},
		};
	// Every part in the person's words, with the weight they add up to.
	const words = items.map((item) => item.amountLabel.trim()).join(", ");
	return words.length > 60
		? entry
		: {
				...entry,
				serving: {
					en: `${words} (${entry.serving.en})`,
					nl: `${words} (${entry.serving.nl})`,
				},
			};
}

/** Totals of all items as one entry, for Opslaan als → Eén item. */
export function combinedNutrients(
	items: readonly ReviewItem[],
): Record<NutrientKey, NutrientValue> {
	const totals = Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [key, { kind: "value", amount: 0 }]),
	) as Record<NutrientKey, NutrientValue>;
	for (const item of items) {
		const nutrients = itemNutrients(item);
		for (const key of NUTRIENT_KEYS) {
			const value = nutrients?.[key];
			const current = totals[key];
			if (!value || value.kind === "absent" || current.kind !== "value")
				totals[key] = { kind: "absent" };
			else if (value.kind === "value")
				totals[key] = { kind: "value", amount: current.amount + value.amount };
		}
	}
	return totals;
}

// ───────────────────────────── label ─────────────────────────────

const LABEL_KEYS: Record<NutrientKey, keyof LabelReading["per100"]> = {
	energy: "energy",
	protein: "protein",
	carbs: "carbs",
	fat: "fat",
	saturatedFat: "saturatedFat",
	fibre: "fibre",
	sugars: "sugars",
	salt: "salt",
};

/** Label values as nutrient states; kJ fills energy only when kcal is missing. */
export function labelNutrients(
	reading: LabelReading,
): Record<NutrientKey, NutrientValue> {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => {
			let amount = reading.per100[LABEL_KEYS[key]];
			if (
				key === "energy" &&
				amount === null &&
				reading.per100.energyKj !== null
			)
				amount = Math.round(reading.per100.energyKj / 4.184);
			return [
				key,
				amount === null ? { kind: "absent" } : { kind: "value", amount },
			];
		}),
	) as Record<NutrientKey, NutrientValue>;
}

export type LabelCheck =
	| "barcodeInvalid"
	| "barcodeMismatch"
	| "energyMismatch"
	| "kjMismatch"
	| "saturatedAboveFat"
	| "sugarsAboveCarbs";

/** Arithmetic that catches a misread digit; each failure is shown, never fixed. */
export function labelChecks(
	reading: LabelReading,
	/** The barcode the food already has, such as a scanned product's. */
	knownBarcode?: string,
): LabelCheck[] {
	const p = reading.per100;
	const failures: LabelCheck[] = [];
	if (reading.barcodeInvalid) failures.push("barcodeInvalid");
	else if (knownBarcode && reading.barcode && reading.barcode !== knownBarcode)
		failures.push("barcodeMismatch");
	if (
		p.energy !== null &&
		p.protein !== null &&
		p.carbs !== null &&
		p.fat !== null
	) {
		const computed =
			4 * p.protein + 4 * p.carbs + 9 * p.fat + 2 * (p.fibre ?? 0);
		if (p.energy > 0 && Math.abs(computed - p.energy) / p.energy > 0.08)
			failures.push("energyMismatch");
	}
	if (p.energy && p.energyKj && Math.abs(p.energyKj / p.energy - 4.184) > 0.1)
		failures.push("kjMismatch");
	if (p.saturatedFat !== null && p.fat !== null && p.saturatedFat > p.fat)
		failures.push("saturatedAboveFat");
	if (p.sugars !== null && p.carbs !== null && p.sugars > p.carbs)
		failures.push("sugarsAboveCarbs");
	return failures;
}

/** A new Personal Food draft from a label; reviewed in the editor before saving. */
export function personalFoodDraftFromReading(
	reading: LabelReading,
): PersonalFoodDraft {
	return {
		name: reading.name,
		baseUnit: reading.basis,
		classification: "ordinary",
		estimated: false,
		nutritionBasis: { kind: "per100", unit: reading.basis },
		nutrients: labelNutrients(reading),
		servings: reading.servings.map((serving) => ({
			label: serving.name,
			amount: serving.amount,
		})),
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: false,
			...(reading.barcode ? { barcode: reading.barcode } : {}),
			...(reading.brand ? { brand: reading.brand } : {}),
			...(reading.packAmount
				? {
						quantity: `${formatQuantity(reading.packAmount, "nl")} ${reading.basis}`,
					}
				: {}),
		},
	};
}
