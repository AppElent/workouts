/**
 * The Open Food Facts client (spec #68).
 *
 * Called directly from the phone — Convex never proxies this, because pooled
 * backend traffic risks provider-wide rate limiting (spec #68). Every
 * outcome is a closed set rather than a thrown error, because every one of
 * them has to leave the caller able to fall back to local Search and Enter
 * manually: an unknown barcode, a timeout, a rate limit, and a product with
 * too little or invalid nutrition data are all first-class results, not
 * exceptions.
 */
import {
	type NutrientKey,
	NUTRIENT_KEYS,
	type NutrientValue,
	OPEN_FOOD_FACTS_ATTRIBUTION,
	parseProviderNumber,
	parseProviderNutrient,
	saltFromSodium,
} from "@workouts/core/nutrition";
import type { PersonalFoodDraft } from "./personal-food-repository";
import type { OpenFoodFactsCache } from "./personal-food-repository";

const OFF_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";
const OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const REQUEST_TIMEOUT_MS = 8000;
const OFF_PROVIDER_LABEL = "Open Food Facts";
const PRODUCT_FIELDS =
	"code,product_name,product_name_en,product_name_nl,brands,quantity,product_quantity_unit,nutriments";

export type OffLookupOutcome =
	| { readonly kind: "found"; readonly draft: PersonalFoodDraft; readonly fromCache: boolean }
	| { readonly kind: "not-found" }
	| { readonly kind: "rate-limited" }
	| { readonly kind: "timeout" }
	| { readonly kind: "network-error" }
	| { readonly kind: "incomplete" }
	| { readonly kind: "invalid" };

export type OffSearchOutcome =
	| { readonly kind: "found"; readonly drafts: readonly PersonalFoodDraft[]; readonly fromCache: boolean }
	| { readonly kind: "not-found" }
	| { readonly kind: "rate-limited" }
	| { readonly kind: "timeout" }
	| { readonly kind: "network-error" };

type OffRawProduct = {
	readonly code?: string;
	readonly product_name?: string;
	readonly product_name_en?: string;
	readonly product_name_nl?: string;
	readonly brands?: string;
	readonly quantity?: string;
	readonly product_quantity_unit?: string;
	readonly nutriments?: Readonly<Record<string, unknown>>;
};

type OffProductResponse = {
	readonly status?: number;
	readonly product?: OffRawProduct;
};

type OffSearchResponse = {
	readonly products?: readonly OffRawProduct[];
};

/** A fetch-shaped dependency, injected so tests exercise the real network boundary rather than an internal mock (spec #68 testing decisions). */
export type FetchLike = (
	input: string,
	init?: {
		readonly headers?: Record<string, string>;
		readonly signal?: AbortSignal;
	},
) => Promise<{
	readonly ok: boolean;
	readonly status: number;
	json(): Promise<unknown>;
}>;

export type OpenFoodFactsClientOptions = {
	readonly cache: OpenFoodFactsCache;
	readonly fetchImpl?: FetchLike;
	readonly now?: () => number;
	readonly timeoutMs?: number;
};

function baseUnitOf(product: OffRawProduct): "g" | "ml" {
	const unit = product.product_quantity_unit?.toLowerCase();
	if (unit === "ml" || unit === "l" || unit === "cl") return "ml";
	if (unit === "g" || unit === "kg") return "g";
	if (product.quantity && /\b(ml|milliliter|millilitre|liter|litre)\b/i.test(product.quantity)) {
		return "ml";
	}
	return "g";
}

function nameOf(product: OffRawProduct): { en: string; nl: string } | undefined {
	const fallback = product.product_name?.trim();
	const en = product.product_name_en?.trim() || fallback;
	const nl = product.product_name_nl?.trim() || fallback;
	if (!en && !nl) return undefined;
	return { en: en || nl || "", nl: nl || en || "" };
}

function readNutrient(
	nutriments: Readonly<Record<string, unknown>> | undefined,
	key: string,
): NutrientValue {
	return parseProviderNutrient(nutriments?.[key]);
}

function saltNutrient(
	nutriments: Readonly<Record<string, unknown>> | undefined,
): NutrientValue {
	const direct = readNutrient(nutriments, "salt_100g");
	if (direct.kind !== "absent") return direct;
	const sodiumGrams = parseProviderNumber(nutriments?.sodium_100g);
	if (sodiumGrams === undefined) return direct;
	return saltFromSodium({ kind: "value", amount: sodiumGrams * 1000 });
}

function energyNutrient(
	nutriments: Readonly<Record<string, unknown>> | undefined,
): NutrientValue {
	const kcal = readNutrient(nutriments, "energy-kcal_100g");
	if (kcal.kind !== "absent") return kcal;
	const kilojoules = parseProviderNumber(nutriments?.["energy_100g"]);
	if (kilojoules === undefined) return kcal;
	return { kind: "value", amount: Math.round((kilojoules / 4.184) * 10) / 10 };
}

const OFF_FIELD_BY_NUTRIENT: Readonly<Record<Exclude<NutrientKey, "energy" | "salt">, string>> = {
	protein: "proteins_100g",
	carbs: "carbohydrates_100g",
	fat: "fat_100g",
	saturatedFat: "saturated-fat_100g",
	fibre: "fiber_100g",
	sugars: "sugars_100g",
};

/**
 * Map one Open Food Facts product into an editable Personal Food draft, or
 * say why it cannot be imported. `incomplete` (a real product with no usable
 * nutrient figures at all) is distinct from `invalid` (no usable name) —
 * both are failure exits back to local Search and Enter manually, but they
 * are different, worth-logging-differently reasons.
 */
export function mapOffProductToDraft(
	product: OffRawProduct,
): { readonly draft: PersonalFoodDraft } | { readonly error: "invalid" | "incomplete" } {
	const name = nameOf(product);
	if (!name) return { error: "invalid" };

	const nutrients = {
		energy: energyNutrient(product.nutriments),
		salt: saltNutrient(product.nutriments),
	} as Record<NutrientKey, NutrientValue>;
	for (const key of Object.keys(OFF_FIELD_BY_NUTRIENT) as (keyof typeof OFF_FIELD_BY_NUTRIENT)[]) {
		nutrients[key] = readNutrient(product.nutriments, OFF_FIELD_BY_NUTRIENT[key]);
	}

	const hasAnyFigure = NUTRIENT_KEYS.some((key) => nutrients[key].kind !== "absent");
	if (!hasAnyFigure) return { error: "incomplete" };

	const draft: PersonalFoodDraft = {
		name,
		baseUnit: baseUnitOf(product),
		nutrients,
		servings: [],
		provenance: {
			recordOrigin: "import",
			nutritionSource: "openfoodfacts",
			locallyEdited: false,
			provider: OFF_PROVIDER_LABEL,
			attribution: OPEN_FOOD_FACTS_ATTRIBUTION,
			...(product.code ? { barcode: product.code } : {}),
		},
	};
	return { draft };
}

async function fetchJson(
	url: string,
	fetchImpl: FetchLike,
	timeoutMs: number,
): Promise<{ kind: "ok"; body: unknown } | { kind: "rate-limited" } | { kind: "timeout" } | { kind: "network-error" }> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetchImpl(url, {
			headers: { Accept: "application/json" },
			signal: controller.signal,
		});
		if (response.status === 429) return { kind: "rate-limited" };
		if (!response.ok) return { kind: "network-error" };
		return { kind: "ok", body: await response.json() };
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			return { kind: "timeout" };
		}
		return { kind: "network-error" };
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Barcode lookup. Callers must check local Personal Foods before calling
 * this (spec #68) — this function only ever reaches the network or the
 * cache, never the on-device food list.
 */
export async function lookupOffBarcode(
	barcode: string,
	options: OpenFoodFactsClientOptions,
): Promise<OffLookupOutcome> {
	const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
	const cacheKey = `barcode:${barcode}`;
	const cached = options.cache.get(cacheKey);
	if (cached) {
		const mapped = mapOffProductToDraft(cached.response as OffRawProduct);
		if ("error" in mapped) return { kind: mapped.error };
		return { kind: "found", draft: mapped.draft, fromCache: true };
	}

	const url = `${OFF_PRODUCT_URL}/${encodeURIComponent(barcode)}.json?fields=${PRODUCT_FIELDS}`;
	const result = await fetchJson(url, fetchImpl, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
	if (result.kind !== "ok") return { kind: result.kind };

	const body = result.body as OffProductResponse;
	if (!body.product || body.status === 0) return { kind: "not-found" };

	options.cache.set(cacheKey, "barcode", body.product);
	const mapped = mapOffProductToDraft(body.product);
	if ("error" in mapped) return { kind: mapped.error };
	return { kind: "found", draft: mapped.draft, fromCache: false };
}

/**
 * The explicit, user-invoked Open Food Facts text search (spec #68) — never
 * called by ordinary local search.
 */
export async function searchOffProducts(
	query: string,
	options: OpenFoodFactsClientOptions,
): Promise<OffSearchOutcome> {
	const trimmed = query.trim();
	if (trimmed.length === 0) return { kind: "not-found" };
	const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
	const cacheKey = `search:${trimmed.toLocaleLowerCase()}`;
	const cached = options.cache.get(cacheKey);
	if (cached) {
		const drafts = (cached.response as OffRawProduct[])
			.map(mapOffProductToDraft)
			.filter((mapped): mapped is { draft: PersonalFoodDraft } => "draft" in mapped)
			.map((mapped) => mapped.draft);
		return drafts.length > 0
			? { kind: "found", drafts, fromCache: true }
			: { kind: "not-found" };
	}

	const params = new URLSearchParams({
		search_terms: trimmed,
		search_simple: "1",
		action: "process",
		json: "1",
		page_size: "20",
		fields: PRODUCT_FIELDS,
	});
	const result = await fetchJson(
		`${OFF_SEARCH_URL}?${params.toString()}`,
		fetchImpl,
		options.timeoutMs ?? REQUEST_TIMEOUT_MS,
	);
	if (result.kind !== "ok") return { kind: result.kind };

	const body = result.body as OffSearchResponse;
	const products = body.products ?? [];
	options.cache.set(cacheKey, "search", products);
	const drafts = products
		.map(mapOffProductToDraft)
		.filter((mapped): mapped is { draft: PersonalFoodDraft } => "draft" in mapped)
		.map((mapped) => mapped.draft);
	return drafts.length > 0
		? { kind: "found", drafts, fromCache: false }
		: { kind: "not-found" };
}
