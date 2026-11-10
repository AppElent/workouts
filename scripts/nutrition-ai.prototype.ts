// PROTOTYPE — throwaway. Runs Hulp bij invoeren end to end against the real
// model, without the app or a Convex deploy: describe → (refine) → ground in
// NEVO → choose, and prints what the review screen would show.
//
//   pnpm prototype:ai-food "broodje pittige kip van de spar"
//   pnpm prototype:ai-food "broodje pittige kip van de spar" --web   (web lookup first, ~1–3 ct)
//   pnpm prototype:ai-food "broodje pittige kip van de spar" --then "de kip was gegrild" --then "geen ui"
//
// Reads ANTHROPIC_API_KEY from the dev Convex deployment.
import type { ShippedFood } from "@foundry/core";
import { searchShippedFoods } from "@foundry/core/shipped-foods";
import {
	type Described,
	describe,
	nutritionAiProvider,
	select,
} from "../convex/lib/nutritionAi";

const argv = process.argv.slice(2);
const text = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--then");
const webSearch = argv.includes("--web");
const followUps = argv.flatMap((a, i) => (argv[i - 1] === "--then" ? [a] : []));
if (!text) throw new Error('Usage: pnpm prototype:ai-food "<text>" [--then "<correction>"]…');

const provider = nutritionAiProvider();
if (!provider) throw new Error("ANTHROPIC_API_KEY is not set.");
const catalog = new Map<string, ShippedFood>();
const round = (n: number) => Math.round(n);

function print(label: string, d: Described) {
	console.log(`\n━━ ${label} ━━`);
	console.log(`seen:  ${d.seen}`);
	console.log(`title: ${d.title}`);
	for (const source of d.sources) console.log(`web:   ${source.title} — ${source.url}`);
	if (d.question) console.log(`ask:   ${d.question.text} [${d.question.options.join(" | ")}]`);
	for (const item of d.items) {
		console.log(
			`• [${item.kind}] ${item.name} — ${item.amountLabel} (${round(item.grams)} g, ${item.confidence})` +
				(item.estimate ? ` ≈ ${round(item.estimate.energy)} kcal` : ""),
		);
		for (const c of item.components)
			console.log(`    · ${c.name} ${round(c.grams)} g ≈ ${round(c.energy)} kcal, P ${round(c.protein)} C ${round(c.carbs)} F ${round(c.fat)}`);
	}
}

let started = Date.now();
let described = await describe(provider, { text, locale: "nl", webSearch });
print(`describe (${Date.now() - started} ms)`, described);
const history: string[] = [];
for (const followUp of followUps) {
	history.push(followUp);
	started = Date.now();
	described = await describe(provider, {
		text,
		locale: "nl",
		previous: JSON.stringify(described),
		followUps: history,
	});
	print(`refine "${followUp}" (${Date.now() - started} ms)`, described);
}

// Ground like the phone: ingredients against NEVO, products only against
// Personal Foods (none here, so products keep their estimate).
const grounded = described.items.map((item) => {
	const found = new Map<string, string>();
	if (item.kind === "ingredient")
		for (const term of [...item.searchTerms, item.name])
			for (const { food } of searchShippedFoods(term, { locale: "nl", limit: 8 }))
				{
					catalog.set(food.id, food);
					found.set(food.id, food.name.nl);
				}
	return { item, candidates: [...found].slice(0, 12).map(([ref, name]) => ({ ref, name })) };
});
const choices = await select(
	provider,
	grounded.map(({ item, candidates }) => ({
		name: item.name,
		amount: item.amount,
		unit: item.unit,
		brand: item.brand,
		product: item.kind === "product",
		candidates,
	})),
);
console.log("\n━━ review ━━");
let total = 0;
for (const [index, { item }] of grounded.entries()) {
	const choice = choices[index];
	const food = choice?.ref ? catalog.get(choice.ref) : undefined;
	const energy = food?.nutrients.energy;
	const kcal = food
		? energy?.kind === "value"
			? (energy.amount * item.grams) / 100
			: 0
		: (item.estimate?.energy ?? choice?.estimate?.energy ?? 0);
	total += kcal;
	console.log(`• ${item.name} → ${food ? `NEVO ${food.name.nl}` : "~ geschat"} · ${item.amountLabel} · ${round(kcal)} kcal`);
}
console.log(`Totaal ≈ ${round(total)} kcal`);
