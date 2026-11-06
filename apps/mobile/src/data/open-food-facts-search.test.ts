import {
	type OffSearchHit,
	planOffSearch,
	rankOffHits,
} from "./open-food-facts-search";

describe("planOffSearch", () => {
	it.each([
		[
			"ah volkoren knackebrod",
			'brands:("ah" OR "albert heijn") volkoren knackebrod',
		],
		[
			"knackebrod volkoren AH",
			'brands:("ah" OR "albert heijn") knackebrod volkoren',
		],
		["albert heijn pindakaas", 'brands:("ah" OR "albert heijn") pindakaas'],
		["de ruijter hagelslag puur", 'brands:"de ruijter" hagelslag puur'],
		["Calvé pindakaas", 'brands:"calvé" pindakaas'],
		["dr. oetker pizza", 'brands:"dr. oetker" pizza'],
	])("filters on the brand in %j", (term, query) => {
		expect(planOffSearch(term).query).toBe(query);
	});

	it("leaves the filtered brand out of the words still to match", () => {
		expect(planOffSearch("ah volkoren knackebrod").words).toEqual([
			"volkoren",
			"knackebrod",
		]);
	});

	it("keeps a term that names no brand as free text", () => {
		expect(planOffSearch("Volkoren Knäckebröd")).toEqual({
			query: "volkoren knäckebröd",
			words: ["volkoren", "knackebrod"],
		});
	});

	it("finds a brand in the middle of a term", () => {
		expect(planOffSearch("yoghurt ah 0%").query).toBe(
			'brands:("ah" OR "albert heijn") yoghurt 0%',
		);
	});

	it("does not read an ordinary word as a brand", () => {
		expect(planOffSearch("bio melk").query).toBe("bio melk");
		expect(planOffSearch("proteine plus").query).toBe("proteine plus");
	});

	it("offers the brand alone as a fallback only when other words remain", () => {
		expect(planOffSearch("duyvis pinda").brandOnlyQuery).toBe(
			'brands:"duyvis"',
		);
		expect(planOffSearch("duyvis").brandOnlyQuery).toBeUndefined();
		expect(planOffSearch("volkoren pasta").brandOnlyQuery).toBeUndefined();
	});

	it.each([
		["melk: vol", "melk vol"],
		["(melk", "melk"],
		['yoghurt "griekse', "yoghurt griekse"],
		["kwark -mager", "kwark mager"],
		["melk AND", "melk and"],
		["melk*", "melk"],
		["vol-vet melk", "vol-vet melk"],
		["m&m's peanut", "m&m's peanut"],
		["grolsch 0.0", 'brands:"grolsch" 0.0'],
	])("keeps query syntax out of %j", (term, query) => {
		expect(planOffSearch(term).query).toBe(query);
	});

	it("has nothing to ask when only syntax was typed", () => {
		expect(planOffSearch(' :"() ').query).toBe("");
	});
});

describe("rankOffHits", () => {
	const named = (
		product_name: string,
		more: Partial<OffSearchHit> = {},
	): OffSearchHit => ({ product_name, ...more });
	const namesOf = (hits: readonly OffSearchHit[]) =>
		hits.map((hit) => hit.product_name);

	it("puts every typed word ahead of partial matches, whatever the provider's order", () => {
		const hits = [
			named("Volkorenbrood"),
			named("Knäckebröd"),
			named("Volkoren knäckebröd"),
		];
		expect(namesOf(rankOffHits(hits, ["volkoren", "knackebrod"]))[0]).toBe(
			"Volkoren knäckebröd",
		);
	});

	it("counts a word in the brand", () => {
		const hits = [
			named("Volkoren knäckebröd", { brands: "Bolletje" }),
			named("Knäckebröd", { brands: ["Wasa", "Volkoren"] }),
			named("Rijstwafels", { brands: "Wasa" }),
		];
		expect(namesOf(rankOffHits(hits, ["wasa", "knackebrod"]))[0]).toBe(
			"Knäckebröd",
		);
	});

	it("finds a word in the categories, below one in the name", () => {
		const hits = [
			named("Volkoren tortilla", {
				categories_tags: ["en:breads", "en:wheat-flatbreads"],
			}),
			named("Volkoren spaghetti", { categories_tags: ["en:pastas"] }),
			named("Volkoren pasta"),
		];
		expect(namesOf(rankOffHits(hits, ["volkoren", "pasta"]))).toEqual([
			"Volkoren pasta",
			"Volkoren spaghetti",
			"Volkoren tortilla",
		]);
	});

	it("prefers the whole word over the same letters inside another", () => {
		const hits = [named("Halfvolle melk"), named("Volle melk")];
		expect(namesOf(rankOffHits(hits, ["volle", "melk"]))[0]).toBe("Volle melk");
	});

	it("reads 0% as mager", () => {
		const hits = [named("Volle kwark"), named("Magere kwark")];
		expect(namesOf(rankOffHits(hits, ["0%", "kwark"]))[0]).toBe("Magere kwark");
	});

	it("prefers products sold in the Netherlands, then Belgium", () => {
		const hits = [
			named("Skyr", { countries_tags: ["en:germany"] }),
			named("Skyr", { countries_tags: ["en:belgium"], brands: "Boni" }),
			named("Skyr", { countries_tags: ["en:netherlands"], brands: "Arla" }),
		];
		expect(rankOffHits(hits, ["skyr"]).map((hit) => hit.brands)).toEqual([
			"Arla",
			"Boni",
			undefined,
		]);
	});

	it("prefers the plainer name, then keeps the provider's order", () => {
		const hits = [
			named("Vegetarische rookworst"),
			named("Rookworst", { brands: "first" }),
			named("Rookworst", { brands: "second" }),
		];
		expect(rankOffHits(hits, ["rookworst"]).map((hit) => hit.brands)).toEqual([
			"first",
			"second",
			undefined,
		]);
	});

	it("keeps a nameless product below a named one", () => {
		const hits: OffSearchHit[] = [{ brands: "Skyr" }, named("Skyr")];
		expect(namesOf(rankOffHits(hits, ["skyr"]))).toEqual(["Skyr", undefined]);
	});
});
