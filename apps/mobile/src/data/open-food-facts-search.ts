/**
 * Turns what a person typed into one Open Food Facts search request, and puts
 * the answer in the order they meant.
 *
 * Search-a-licious ORs free-text words and offers no way to require them, so a
 * term like "ah volkoren knackebrod" can leave the wanted product outside even
 * the first 500 hits. A brand named in the term therefore becomes a filter, and
 * the remaining words are ranked here over a wide page of hits. It stays one
 * request whenever it can: a routine second one would halve the searches the
 * shared budget allows per minute.
 */
import { OFF_BRAND_SLUGS } from "./open-food-facts-brands";

export type OffSearchHit = {
	readonly product_name?: string;
	readonly product_name_en?: string;
	readonly product_name_nl?: string;
	readonly brands?: string | readonly string[];
	readonly countries_tags?: readonly string[];
	readonly categories?: string | readonly string[];
	readonly categories_tags?: readonly string[];
};

export type OffSearchPlan = {
	/** The provider query; empty when nothing searchable is left. */
	readonly query: string;
	/** The words still to match, without any brand the query filters on. */
	readonly words: readonly string[];
	/**
	 * The brand on its own, for when the filtered query finds nothing: the
	 * provider matches whole words, so "pinda" misses "pinda's" of that brand.
	 */
	readonly brandOnlyQuery?: string;
};

const MAX_BRAND_WORDS = 3;
const MIN_PARTIAL_MATCH_LENGTH = 4;

/** Brands sold under several names, each of which the provider files separately. */
const BRAND_NAMES: Readonly<Record<string, readonly string[]>> = {
	ah: ["ah", "albert heijn"],
	"albert-heijn": ["ah", "albert heijn"],
};

/** Dairy labels say "mager" where people type "0%". */
const WORD_SYNONYMS: Readonly<Record<string, string>> = { "0%": "mager" };

function fold(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

function wordsOf(text: string): string[] {
	return fold(text)
		.split(/[^\p{L}\p{N}.,&'%]+/u)
		.map((word) => word.replace(/^[.,']+|[.,']+$/g, ""))
		.filter(Boolean);
}

/** A stray colon or quote would otherwise be read as query syntax: "melk: vol" finds nothing. */
function withoutQuerySyntax(term: string): string {
	return term
		.replace(/[:"()^~*?\\[\]{}+!/|<>=]/g, " ")
		.replace(/(^|\s)-+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.toLocaleLowerCase();
}

function brandSlug(words: readonly string[]): string {
	return fold(words.join(" "))
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-|-$/g, "");
}

function brandFilter(slug: string, typed: readonly string[]): string {
	const names = BRAND_NAMES[slug] ?? [typed.join(" ")];
	const quoted = names.map((name) => `"${name}"`);
	return quoted.length > 1
		? `brands:(${quoted.join(" OR ")})`
		: `brands:${quoted[0]}`;
}

export function planOffSearch(term: string): OffSearchPlan {
	const text = withoutQuerySyntax(term);
	const typed = text.split(" ").filter(Boolean);
	for (let size = MAX_BRAND_WORDS; size > 0; size -= 1) {
		if (size > typed.length) continue;
		for (let from = 0; from + size <= typed.length; from += 1) {
			const brand = typed.slice(from, from + size);
			const slug = brandSlug(brand);
			if (!OFF_BRAND_SLUGS.has(slug)) continue;
			const rest = [...typed.slice(0, from), ...typed.slice(from + size)];
			const filter = brandFilter(slug, brand);
			return {
				query: [filter, ...rest].join(" "),
				words: wordsOf(rest.join(" ")),
				...(rest.length > 0 ? { brandOnlyQuery: filter } : {}),
			};
		}
	}
	return { query: text, words: wordsOf(text) };
}

function matchesExactly(tokens: readonly string[], word: string): boolean {
	return tokens.includes(word);
}

function matches(tokens: readonly string[], word: string): boolean {
	const synonym = WORD_SYNONYMS[word];
	return tokens.some(
		(token) =>
			token === word ||
			// Dutch compounds and endings: "melk" in "karnemelk", "magere" for "mager".
			(word.length >= MIN_PARTIAL_MATCH_LENGTH && token.includes(word)) ||
			(token.length >= MIN_PARTIAL_MATCH_LENGTH && word.startsWith(token)) ||
			(synonym !== undefined && token.startsWith(synonym)),
	);
}

function textOf(value: string | readonly string[] | undefined): string {
	return typeof value === "string" ? value : (value ?? []).join(" ");
}

function marketRank(hit: OffSearchHit): number {
	const countries = hit.countries_tags ?? [];
	if (countries.includes("en:netherlands")) return 2;
	return countries.includes("en:belgium") ? 1 : 0;
}

/**
 * Best first: every typed word found, then found as whole words in the name or
 * brand, then sold here, then the fewest other words in the name, so a plain
 * "Rookworst" leads "Vegetarische rookworst". The provider's order settles ties.
 */
export function rankOffHits<Hit extends OffSearchHit>(
	hits: readonly Hit[],
	words: readonly string[],
): Hit[] {
	return hits
		.map((hit, index) => {
			const name = wordsOf(
				[hit.product_name, hit.product_name_nl, hit.product_name_en]
					.filter(Boolean)
					.join(" "),
			);
			const shown = wordsOf(
				hit.product_name_nl || hit.product_name || hit.product_name_en || "",
			);
			const named = [...name, ...wordsOf(textOf(hit.brands))];
			const category = wordsOf(
				[
					...(hit.categories_tags ?? []).map((tag) =>
						tag.replace(/^[a-z]+:/, "").replace(/-/g, " "),
					),
					textOf(hit.categories),
				].join(" "),
			);
			const inName = words.filter((word) => matches(named, word)).length;
			return {
				hit,
				index,
				covered: words.filter(
					(word) => matches(named, word) || matches(category, word),
				).length,
				exact: words.filter((word) => matchesExactly(named, word)).length,
				market: marketRank(hit),
				otherWords: shown.length
					? Math.max(0, new Set(shown).size - inName)
					: Number.POSITIVE_INFINITY,
			};
		})
		.sort(
			(a, b) =>
				b.covered - a.covered ||
				b.exact - a.exact ||
				b.market - a.market ||
				(a.otherWords === b.otherWords ? 0 : a.otherWords - b.otherWords) ||
				a.index - b.index,
		)
		.map(({ hit }) => hit);
}
