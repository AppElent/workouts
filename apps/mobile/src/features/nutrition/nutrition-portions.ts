import { normaliseForSearch } from "@foundry/core";
/**
 * What one of something weighs when nobody said, so the same words give the
 * same grams. `kcal` is for ready-made products the food database has no good
 * row for. Typical Dutch portions from general knowledge; not yet checked
 * against a published source.
 */
export type TypicalPortion = {
	readonly name: RegExp;
	readonly grams: number;
	readonly kcal?: number;
	/** Only for this measure: "8 stukjes" sushi has a weight, "sushi" has none. */
	readonly counts?: RegExp;
};

const PORTIONS: readonly TypicalPortion[] = [
	{
		name: /^(patatjes?|patat|frietjes?|friet)\s+oorlog\b/,
		grams: 260,
		kcal: 680,
	},
	{
		name: /^(patatjes?|patat|frietjes?|friet)\s+speciaal\b/,
		grams: 230,
		kcal: 580,
	},
	{
		name: /^(patatjes?|patat|frietjes?|friet|frites)\b/,
		grams: 165,
		kcal: 440,
	},
	{ name: /^(broodje kroket|kroket op brood)\b/, grams: 135, kcal: 400 },
	{ name: /^(kroket(ten)?|kroketjes?)\b/, grams: 100, kcal: 260 },
	{ name: /^frikandel speciaal\b/, grams: 130, kcal: 340 },
	{ name: /^frikandel(len)?\b/, grams: 85, kcal: 230 },
	{ name: /^kaassouffles?\b/, grams: 70, kcal: 220 },
	{ name: /^(bami|nasi)schij(f|ven)\b/, grams: 110, kcal: 300 },
	{ name: /^(ham|cheese)burgers?\b/, grams: 170, kcal: 420 },
	{ name: /^(d[oe]ner|kebab)\b/, grams: 350, kcal: 750 },
	{ name: /^kapsalon\b/, grams: 600, kcal: 1200 },
	{ name: /^sushi\b/, grams: 30, kcal: 45, counts: /stuk/ },
	{
		name: /^(eiwitre(ep|pen|epjes?)|proteinere(ep|pen|epjes?)|protein bars?)\b/,
		grams: 55,
		kcal: 205,
	},
	{ name: /^(\w+ )?(crackers?|knackebrod)\b/, grams: 10 },
	{ name: /^rijstwafels?\b/, grams: 9 },
	{ name: /^(proteine(shakes?|poeder)|whey)\b/, grams: 30 },
	{ name: /^krentenbol(len|letjes?)?\b/, grams: 60 },
	{ name: /^croissant(s|jes?)?\b/, grams: 55 },
	{ name: /^gevulde koek(en|jes?)?\b/, grams: 65 },
	{ name: /^stroopwafel(s|tjes?)?\b/, grams: 30 },
	{ name: /^gehaktbal(len)?\b/, grams: 100 },
	{ name: /^mandarijn(en|tjes?)?\b/, grams: 70 },
	{ name: /^(appel(s|en|tjes?)?)\b/, grams: 150 },
	{ name: /^(banaan(tjes?)?|bananen)\b/, grams: 120 },
	{ name: /^kiwi\b/, grams: 75 },
	{ name: /^sinaasappel(s|en|tjes?)?\b/, grams: 130 },
	{ name: /^mars(reep|repen)?\b/, grams: 51 },
	{
		name: /^(\w+ )?(kwark|skyr|yoghurt)\b/,
		grams: 200,
		counts: /bakje|kom|schaal/,
	},
	{ name: /^pizza(punt(en)?|'s)?\b/, grams: 125, counts: /stuk|punt/ },
];

export function typicalPortion(
	name: string,
	amountLabel: string,
): TypicalPortion | undefined {
	const plain = normaliseForSearch(name);
	// "Stamppot met gehaktbal" and "hamburger met friet" are more than that food.
	if (/\b(?:met|with)\b/.test(plain)) return undefined;
	return PORTIONS.find(
		(portion) =>
			portion.name.test(plain) &&
			(!portion.counts || portion.counts.test(amountLabel.toLowerCase())),
	);
}
