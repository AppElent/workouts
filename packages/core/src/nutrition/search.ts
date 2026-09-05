import { shippedLibrary } from "./library";
import type { Locale, ShippedFood } from "./types";

/**
 * Search over the shipped library.
 *
 * Two tiers, as the spec requires. `promoted` — the ordinary path — returns
 * only the ~150 curated foods, so a search for "banaan" does not bury the
 * banana under twelve NEVO rows for banana bread. `all` reaches every shipped
 * row, still ranking promoted foods first.
 *
 * The public shape of this module is fixed even though the internal strategy is
 * not: today it is a lazily built in-memory index over normalised strings, and
 * it may become something else once device measurements say so (#71, D18).
 */
export type SearchScope = "promoted" | "all";

export type SearchMatch = "name" | "alias" | "sourceName";

export type FoodSearchResult = {
	readonly food: ShippedFood;
	readonly score: number;
	/** Which kind of text matched — enough for the UI to explain a hit. */
	readonly matched: SearchMatch;
	/** The text that matched, as stored. */
	readonly matchedText: string;
};

export type SearchOptions = {
	/** Which language's names to prefer. Both are always searched. */
	readonly locale?: Locale;
	readonly scope?: SearchScope;
	readonly limit?: number;
};

/**
 * Fold the accented letters that occur in Dutch and English food names.
 *
 * Deliberately a table rather than `normalize("NFD")`: this runs on Hermes,
 * whose Unicode surface varies by build, and the alternative is a silent
 * behaviour difference between the test run and the phone.
 */
const FOLD: Record<string, string> = {
	à: "a",
	á: "a",
	â: "a",
	ã: "a",
	ä: "a",
	å: "a",
	æ: "ae",
	ç: "c",
	è: "e",
	é: "e",
	ê: "e",
	ë: "e",
	ì: "i",
	í: "i",
	î: "i",
	ï: "i",
	ñ: "n",
	ò: "o",
	ó: "o",
	ô: "o",
	õ: "o",
	ö: "o",
	ø: "o",
	ù: "u",
	ú: "u",
	û: "u",
	ü: "u",
	ý: "y",
	ÿ: "y",
	ß: "ss",
};

/** Lowercase, fold accents, and reduce punctuation to single spaces. */
export function normaliseForSearch(text: string): string {
	let out = "";
	for (const character of text.toLowerCase()) {
		const folded = FOLD[character];
		if (folded !== undefined) out += folded;
		else if (
			(character >= "a" && character <= "z") ||
			(character >= "0" && character <= "9")
		)
			out += character;
		else out += " ";
	}
	return out.trim().replace(/\s+/g, " ");
}

type Field = {
	readonly text: string;
	readonly normalised: string;
	readonly locale: Locale;
	readonly kind: SearchMatch;
};

type IndexEntry = {
	readonly food: ShippedFood;
	readonly fields: readonly Field[];
};

function fieldsFor(food: ShippedFood): Field[] {
	const fields: Field[] = [];
	const push = (text: string, locale: Locale, kind: SearchMatch) => {
		const normalised = normaliseForSearch(text);
		if (normalised.length > 0) fields.push({ text, normalised, locale, kind });
	};

	push(food.name.en, "en", "name");
	push(food.name.nl, "nl", "name");
	if (food.promoted) {
		// A promoted food's NEVO name is still reachable, just weighted lower.
		push(food.sourceName.en, "en", "sourceName");
		push(food.sourceName.nl, "nl", "sourceName");
	}
	for (const alias of food.aliases.en) push(alias, "en", "alias");
	for (const alias of food.aliases.nl) push(alias, "nl", "alias");
	return fields;
}

let index: IndexEntry[] | undefined;
let promotedIndex: IndexEntry[] | undefined;

function ensureIndex(): { all: IndexEntry[]; promoted: IndexEntry[] } {
	if (!index || !promotedIndex) {
		const library = shippedLibrary();
		index = library.active.map((food) => ({ food, fields: fieldsFor(food) }));
		promotedIndex = index.filter((entry) => entry.food.promoted);
	}
	return { all: index, promoted: promotedIndex };
}

const FIELD_WEIGHT: Record<SearchMatch, number> = {
	name: 1,
	alias: 0.8,
	// NEVO's own names are identification strings ("Mutton >10g fat raw av"),
	// useful to reach but never the best answer to a typed query.
	sourceName: 0.45,
};

/** Score one field against a normalised query. 0 means no match. */
function scoreField(
	haystack: string,
	query: string,
	tokens: readonly string[],
): number {
	if (haystack === query) return 100;
	if (haystack.startsWith(query)) return 80;
	if (haystack.includes(` ${query}`)) return 65;
	if (haystack.includes(query)) return 40;
	if (tokens.length > 1 && tokens.every((token) => haystack.includes(token)))
		return 30;
	return 0;
}

/**
 * Ranked matches.
 *
 * An empty query in `promoted` scope is a browse request and returns the whole
 * promoted list; in `all` scope it returns nothing, because dumping 2,328 NEVO
 * rows at someone who has typed nothing is not a search result.
 */
export function searchShippedFoods(
	query: string,
	options: SearchOptions = {},
): FoodSearchResult[] {
	const locale = options.locale ?? "en";
	const scope = options.scope ?? "promoted";
	const limit = options.limit ?? 50;
	const normalised = normaliseForSearch(query);
	const entries =
		scope === "promoted" ? ensureIndex().promoted : ensureIndex().all;

	if (normalised.length === 0) {
		if (scope !== "promoted") return [];
		return entries
			.map((entry) => ({
				food: entry.food,
				score: 0,
				matched: "name" as const,
				matchedText: entry.food.name[locale],
			}))
			.sort((a, b) => a.food.name[locale].localeCompare(b.food.name[locale]))
			.slice(0, limit);
	}

	const tokens = normalised.split(" ");
	const results: FoodSearchResult[] = [];

	for (const entry of entries) {
		let best = 0;
		let bestField: Field | undefined;
		for (const field of entry.fields) {
			const raw = scoreField(field.normalised, normalised, tokens);
			if (raw === 0) continue;
			const score =
				raw * FIELD_WEIGHT[field.kind] + (field.locale === locale ? 4 : 0);
			if (score > best) {
				best = score;
				bestField = field;
			}
		}
		if (best === 0 || !bestField) continue;
		results.push({
			food: entry.food,
			// Promoted foods always outrank raw NEVO rows, however good the raw
			// match is — that is the whole point of the overlay.
			score: entry.food.promoted ? best + 1000 : best,
			matched: bestField.kind,
			matchedText: bestField.text,
		});
	}

	results.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		const lengthDelta = a.food.name[locale].length - b.food.name[locale].length;
		if (lengthDelta !== 0) return lengthDelta;
		return a.food.id < b.food.id ? -1 : a.food.id > b.food.id ? 1 : 0;
	});

	return results.slice(0, limit);
}

/** Promoted foods in one category, for browsing rather than searching. */
export function browsePromotedByCategory(
	category: string,
	locale: Locale = "en",
): ShippedFood[] {
	return shippedLibrary()
		.promoted.filter((food) => food.category === category)
		.sort((a, b) => a.name[locale].localeCompare(b.name[locale]));
}

/** Drop the memoised index. Benchmarks and tests only. */
export function resetSearchIndex(): void {
	index = undefined;
	promotedIndex = undefined;
}
