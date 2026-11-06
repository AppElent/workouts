/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import { DAILY_ANALYSES } from "./nutritionAi";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const item = {
	name: "Volkorenbrood",
	amount: 70,
	unit: "g",
	grams: 70,
	amountLabel: "2 sneetjes",
	confidence: "high",
	brand: null,
	searchTerms: ["brood volkoren", "brood"],
};

function fake(answers: Record<string, unknown>) {
	vi.stubEnv("NUTRITION_AI_PROVIDER", "fake");
	vi.stubEnv("NUTRITION_AI_FAKE", JSON.stringify(answers));
}

afterEach(() => vi.unstubAllEnvs());

describe("nutrition AI", () => {
	it("requires a signed-in account", async () => {
		fake({ describe: { kind: "meal", seen: "", items: [item] } });
		const t = convexTest(schema, modules);
		await expect(
			t.action(api.nutritionAi.describe, { text: "brood", locale: "nl" }),
		).rejects.toThrow("unauthenticated");
	});

	it("reports an unconfigured provider instead of failing silently", async () => {
		vi.stubEnv("ANTHROPIC_API_KEY", "");
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		await expect(
			alice.action(api.nutritionAi.describe, { text: "brood", locale: "nl" }),
		).rejects.toThrow("unavailable");
	});

	it("returns everything the model's schema asks of an item", async () => {
		fake({
			describe: {
				kind: "meal",
				seen: "Brood",
				title: "Brood",
				question: null,
				items: [
					{
						...item,
						id: null,
						kind: "ingredient",
						amountStated: false,
						components: [],
						estimate: null,
					},
				],
			},
		});
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		const result = await alice.action(api.nutritionAi.describe, {
			text: "brood",
			locale: "nl",
		});
		expect(result.items[0]?.amountStated).toBe(false);
	});

	it("turns a meal without usable items into no_food", async () => {
		fake({
			describe: { kind: "meal", seen: "?", items: [{ ...item, amount: 0 }] },
		});
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		const result = await alice.action(api.nutritionAi.describe, {
			text: "asdf",
			locale: "nl",
		});
		expect(result).toEqual({
			sources: [],
			kind: "no_food",
			seen: "?",
			title: "?",
			question: null,
			items: [],
		});
	});

	it("only accepts offered refs and keeps an estimate only for unmatched items", async () => {
		fake({
			select: {
				choices: [
					{ index: 0, ref: "shipped:made-up", estimate: null },
					{
						index: 1,
						ref: "shipped:bread",
						estimate: {
							energy: 1,
							protein: 1,
							carbs: 1,
							fat: 1,
							saturatedFat: 1,
							sugars: 1,
							fibre: 1,
							salt: 1,
						},
					},
				],
			},
		});
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await t.run((ctx) =>
			ctx.db.insert("nutritionAiUsage", {
				userId: "alice",
				day: new Date().toISOString().slice(0, 10),
				count: 1,
				choices: 1,
			}),
		);
		// Analyses grant two selections (one retry); this row has one left.
		const choices = await alice.action(api.nutritionAi.choose, {
			items: [
				{
					name: "Pannenkoek",
					amount: 120,
					unit: "g",
					brand: null,
					candidates: [],
				},
				{
					name: "Brood",
					amount: 70,
					unit: "g",
					brand: null,
					candidates: [{ ref: "shipped:bread", name: "Brood" }],
				},
			],
		});
		expect(choices).toEqual([
			{ index: 0, ref: null, estimate: null },
			{ index: 1, ref: "shipped:bread", estimate: null },
		]);
	});

	it("drops an unreadable barcode and keeps at most three servings", async () => {
		const per100 = {
			energyKj: 1160,
			energy: 275,
			fat: 7.1,
			saturatedFat: 1.8,
			carbs: 42,
			sugars: 5.1,
			fibre: 1.7,
			protein: 10,
			salt: 0.93,
		};
		const serving = { name: { en: "Portion", nl: "Portie" }, amount: 125 };
		fake({
			label: {
				isLabel: true,
				name: { en: "Tortellini", nl: "Tortellini" },
				brand: "PLUS",
				barcode: "8710624419012",
				packAmount: 250,
				basis: "g",
				per100,
				servings: [serving, serving, serving, serving],
				notes: "",
			},
		});
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		const label = await alice.action(api.nutritionAi.readLabel, {
			image: { mediaType: "image/jpeg", base64: "aGk=" },
			locale: "nl",
		});
		expect(label.barcode).toBeNull();
		expect(label.barcodeInvalid).toBe(true);
		expect(label.servings).toHaveLength(3);
		expect(label.per100).toEqual(per100);
	});

	it("stops after the daily number of analyses for that account only", async () => {
		fake({ describe: { kind: "meal", seen: "brood", items: [item] } });
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const day = new Date().toISOString().slice(0, 10);
		await t.run((ctx) =>
			ctx.db.insert("nutritionAiUsage", {
				userId: "alice",
				day,
				count: DAILY_ANALYSES - 1,
			}),
		);
		await alice.action(api.nutritionAi.describe, {
			text: "brood",
			locale: "nl",
		});
		await expect(
			alice.action(api.nutritionAi.describe, { text: "brood", locale: "nl" }),
		).rejects.toThrow("limit");
		const bob = t.withIdentity({ subject: "bob" });
		await expect(
			bob.action(api.nutritionAi.describe, { text: "brood", locale: "nl" }),
		).resolves.toMatchObject({ kind: "meal" });
	});

	it("scales an estimate given per 100 to the item's amount", async () => {
		const per100 = {
			energy: 70,
			protein: 2,
			carbs: 12,
			fat: 1,
			saturatedFat: 0,
			sugars: 0,
			fibre: 1,
			salt: 0,
		};
		fake({
			describe: { kind: "meal", seen: "havermout", items: [item] },
			select: { choices: [{ index: 0, ref: null, estimate: per100 }] },
		});
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		await alice.action(api.nutritionAi.describe, {
			text: "havermout",
			locale: "nl",
		});
		const [choice] = await alice.action(api.nutritionAi.choose, {
			items: [
				{
					name: "Havermout gekookt",
					amount: 250,
					unit: "g",
					brand: null,
					candidates: [],
				},
			],
		});
		expect(choice?.estimate?.energy).toBe(175);
	});

	it("treats 0 kcal as a failed estimate unless the food really has none", async () => {
		const zero = {
			energy: 0,
			protein: 0,
			carbs: 0,
			fat: 0,
			saturatedFat: 0,
			sugars: 0,
			fibre: 0,
			salt: 0,
		};
		fake({
			describe: { kind: "meal", seen: "x", items: [item] },
			select: { choices: [{ index: 0, ref: null, estimate: zero }] },
		});
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		const estimateFor = async (name: string) => {
			await alice.action(api.nutritionAi.describe, {
				text: name,
				locale: "nl",
			});
			const [choice] = await alice.action(api.nutritionAi.choose, {
				items: [{ name, amount: 200, unit: "g", brand: null, candidates: [] }],
			});
			return choice?.estimate;
		};
		for (const name of [
			"Watermeloen",
			"Ijsthee",
			"Koffiekoek",
			"Mayonaise light",
			"Theelepel suiker",
		])
			expect(await estimateFor(name)).toBeNull();
		for (const name of [
			"Water",
			"Kraanwater",
			"Muntthee",
			"Thee",
			"Zwarte koffie",
			"Cola zero",
			"Cola light",
		])
			expect((await estimateFor(name))?.energy).toBe(0);
	});

	it("drops a fat nobody mentioned from a first analysis", async () => {
		const oil = {
			...item,
			name: "Zonnebloemolie",
			searchTerms: ["olie"],
		};
		fake({
			describe: { kind: "meal", seen: "ei", items: [item, oil] },
		});
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		const plain = await alice.action(api.nutritionAi.describe, {
			text: "gebakken ei",
			locale: "nl",
		});
		expect(plain.items).toHaveLength(1);
		const twice = { ...item, name: "Boter (bakken)", searchTerms: ["boter"] };
		fake({
			describe: {
				kind: "meal",
				seen: "ei",
				items: [
					{ ...item, name: "Boter", searchTerms: ["boter"] },
					{ ...item, name: "Gebakken ei" },
					twice,
				],
			},
		});
		const spread = await alice.action(api.nutritionAi.describe, {
			text: "boterham met boter en een gebakken ei",
			locale: "nl",
		});
		expect(spread.items.map((row) => row.name)).toEqual([
			"Boter",
			"Gebakken ei",
		]);
		fake({
			describe: { kind: "meal", seen: "ei", items: [item, oil] },
		});
		fake({
			describe: {
				kind: "meal",
				seen: "ei",
				items: [
					item,
					{ ...item, name: "Olijfolie (bakken)", searchTerms: ["olie"] },
					{
						...item,
						name: "Gebakken champignons",
						searchTerms: ["champignons"],
					},
				],
			},
		});
		const named = await alice.action(api.nutritionAi.describe, {
			text: "2 eieren in 30 g olie en gebakken champignons",
			locale: "nl",
		});
		expect(named.items).toHaveLength(3);
		fake({
			describe: { kind: "meal", seen: "ei", items: [item, oil] },
		});
		const salad = await alice.action(api.nutritionAi.describe, {
			text: "salade",
			locale: "nl",
		});
		expect(salad.items).toHaveLength(2);
		const fatNamed = await alice.action(api.nutritionAi.describe, {
			text: "gebakken ei in olie",
			locale: "nl",
		});
		expect(fatNamed.items).toHaveLength(2);
	});

	it("allows two candidate selections per analysis, not on their own", async () => {
		fake({
			describe: { kind: "meal", seen: "brood", items: [item] },
			select: { choices: [{ index: 0, ref: null, estimate: null }] },
		});
		const alice = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		const choose = {
			items: [
				{
					name: "Brood",
					amount: 70,
					unit: "g" as const,
					brand: null,
					candidates: [],
				},
			],
		};
		await expect(alice.action(api.nutritionAi.choose, choose)).rejects.toThrow(
			"limit",
		);
		await alice.action(api.nutritionAi.describe, {
			text: "brood",
			locale: "nl",
		});
		// The second is the one retry the phone gets after a failed match.
		await alice.action(api.nutritionAi.choose, choose);
		await alice.action(api.nutritionAi.choose, choose);
		await expect(alice.action(api.nutritionAi.choose, choose)).rejects.toThrow(
			"limit",
		);
	});
});
