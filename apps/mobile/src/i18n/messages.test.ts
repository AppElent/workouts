/**
 * Both trees say the same things, in the same places, with the same
 * placeholders.
 *
 * `satisfies typeof en` in `nl.ts` already catches a missing or extra key at
 * typecheck time. What it cannot catch is a translation that drops a `{name}`
 * placeholder or invents one — which reaches the user as a literal brace in the
 * middle of a sentence, in one language only.
 *
 * The web app gets this from `@appelent/i18n/test-utils`; that module is built
 * against jsdom and RTL-DOM, so the phone walks the trees itself.
 */
import { en } from "./messages/en";
import { nl } from "./messages/nl";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
	const flat = new Map<string, string>();
	for (const [key, value] of Object.entries(tree)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") {
			flat.set(path, value);
		} else {
			for (const [nested, nestedValue] of flatten(value, path)) {
				flat.set(nested, nestedValue);
			}
		}
	}
	return flat;
}

function placeholders(template: string): string[] {
	return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

const english = flatten(en as unknown as Tree);
const dutch = flatten(nl as unknown as Tree);

describe("message trees", () => {
	it("cover the same keys in both languages", () => {
		expect([...dutch.keys()].sort()).toEqual([...english.keys()].sort());
	});

	it("use the same placeholders in both languages", () => {
		for (const [key, template] of english) {
			expect({ key, placeholders: placeholders(dutch.get(key) ?? "") }).toEqual({
				key,
				placeholders: placeholders(template),
			});
		}
	});

	it("leave no message empty", () => {
		for (const [key, template] of [...english, ...dutch]) {
			expect({ key, empty: template.trim().length === 0 }).toEqual({
				key,
				empty: false,
			});
		}
	});
});
