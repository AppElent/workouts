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
		const alice = convexTest(schema, modules).withIdentity({ subject: "alice" });
		await expect(
			alice.action(api.nutritionAi.describe, { text: "brood", locale: "nl" }),
		).rejects.toThrow("unavailable");
	});

	it("turns a meal without usable items into no_food", async () => {
		fake({
			describe: { kind: "meal", seen: "?", items: [{ ...item, amount: 0 }] },
		});
		const alice = convexTest(schema, modules).withIdentity({ subject: "alice" });
		const result = await alice.action(api.nutritionAi.describe, {
			text: "asdf",
			locale: "nl",
		});
		expect(result).toEqual({ kind: "no_food", seen: "?", items: [] });
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
		const choices = await alice.action(api.nutritionAi.choose, {
			items: [
				{ name: "Pannenkoek", amount: 120, unit: "g", brand: null, candidates: [] },
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
		const alice = convexTest(schema, modules).withIdentity({ subject: "alice" });
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
		await alice.action(api.nutritionAi.describe, { text: "brood", locale: "nl" });
		await expect(
			alice.action(api.nutritionAi.describe, { text: "brood", locale: "nl" }),
		).rejects.toThrow("limit");
		const bob = t.withIdentity({ subject: "bob" });
		await expect(
			bob.action(api.nutritionAi.describe, { text: "brood", locale: "nl" }),
		).resolves.toMatchObject({ kind: "meal" });
	});

	it("allows one candidate selection per analysis, not on its own", async () => {
		fake({
			describe: { kind: "meal", seen: "brood", items: [item] },
			select: { choices: [{ index: 0, ref: null, estimate: null }] },
		});
		const alice = convexTest(schema, modules).withIdentity({ subject: "alice" });
		const choose = {
			items: [
				{ name: "Brood", amount: 70, unit: "g" as const, brand: null, candidates: [] },
			],
		};
		await expect(alice.action(api.nutritionAi.choose, choose)).rejects.toThrow(
			"limit",
		);
		await alice.action(api.nutritionAi.describe, { text: "brood", locale: "nl" });
		await alice.action(api.nutritionAi.choose, choose);
		await expect(alice.action(api.nutritionAi.choose, choose)).rejects.toThrow(
			"limit",
		);
	});
});
