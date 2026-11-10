/** The languages Foundry ships, in fallback order. */
export const SUPPORTED_LOCALES = ["en", "nl"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale<L extends string>(
	locales: readonly L[],
	value: unknown,
): value is L {
	return (locales as readonly unknown[]).includes(value);
}

/**
 * Resolve the active locale: explicit cookie choice first, then the first
 * Accept-Language entry matching a supported locale, then the fallback.
 */
export function resolveLocale<L extends string>(
	locales: readonly L[],
	fallback: L,
	cookieValue: string | undefined,
	acceptLanguage: string | undefined,
): L {
	if (isLocale(locales, cookieValue)) return cookieValue;
	if (acceptLanguage) {
		for (const part of acceptLanguage.split(",")) {
			const tag = part.split(";")[0]?.trim().toLowerCase();
			if (!tag) continue;
			for (const locale of locales) {
				if (tag === locale || tag.startsWith(`${locale}-`)) return locale;
			}
		}
	}
	return fallback;
}

/** Interpolate {name} placeholders. Unknown placeholders are left as-is. */
export function fmt(
	template: string,
	params: Record<string, string | number>,
): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in params ? String(params[key]) : match,
	);
}

/**
 * Pick a plural form and fill {count}. Assumes one/other CLDR categories.
 *
 * Hermes may lack `Intl.PluralRules` (appelent-packages#16); the fallback is
 * exact for every locale whose CLDR `one` is `i = 1 and v = 0`, which English
 * and Dutch both are.
 */
export function plural<L extends string>(
	locale: L,
	count: number,
	forms: { one: string; other: string },
): string {
	const category =
		typeof Intl?.PluralRules === "function"
			? new Intl.PluralRules(locale).select(count)
			: count === 1
				? "one"
				: "other";
	return fmt(category === "one" ? forms.one : forms.other, { count });
}

type MessageTree = { readonly [key: string]: string | MessageTree };

type MessageParityMismatch =
	| {
			readonly kind: "missingKey";
			readonly locale: string;
			readonly path: string;
	  }
	| {
			readonly kind: "extraKey";
			readonly locale: string;
			readonly path: string;
	  }
	| {
			readonly kind: "emptyMessage";
			readonly locale: string;
			readonly path: string;
	  }
	| {
			readonly kind: "placeholders";
			readonly locale: string;
			readonly path: string;
			readonly expected: readonly string[];
			readonly actual: readonly string[];
	  };

function leaves(
	tree: MessageTree,
	prefix = "",
	out = new Map<string, string>(),
) {
	for (const [key, value] of Object.entries(tree)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") out.set(path, value);
		else leaves(value, path, out);
	}
	return out;
}

function placeholders(message: string): string[] {
	return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

/**
 * Every way the message trees disagree with the first one: missing or extra
 * keys, empty messages, and different `{placeholder}` sets. Empty means the
 * catalogs agree; a test asserts `toEqual([])` under any runner.
 */
export function messageParityMismatches(
	locales: Readonly<Record<string, MessageTree>>,
): MessageParityMismatch[] {
	const mismatches: MessageParityMismatch[] = [];
	const trees = Object.entries(locales).map(
		([locale, tree]) => [locale, leaves(tree)] as const,
	);
	for (const [locale, messages] of trees) {
		for (const [path, message] of messages) {
			if (!message.trim())
				mismatches.push({ kind: "emptyMessage", locale, path });
		}
	}
	const [first, ...rest] = trees;
	if (!first) return mismatches;
	const [, reference] = first;
	for (const [locale, messages] of rest) {
		for (const [path, expected] of reference) {
			const actual = messages.get(path);
			if (actual === undefined) {
				mismatches.push({ kind: "missingKey", locale, path });
				continue;
			}
			const want = placeholders(expected);
			const got = placeholders(actual);
			if (want.join(",") !== got.join(","))
				mismatches.push({
					kind: "placeholders",
					locale,
					path,
					expected: want,
					actual: got,
				});
		}
		for (const path of messages.keys()) {
			if (!reference.has(path))
				mismatches.push({ kind: "extraKey", locale, path });
		}
	}
	return mismatches;
}
