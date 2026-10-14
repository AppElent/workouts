// PROTOTYPE — throwaway. Runs the agreed cases over a model × effort × strategy
// matrix and prints pass/fail, cost and latency.
//
//   infisical run --env=dev --path=/foundry -- pnpm --filter @foundry/core prototype:nutrition-ai:eval
//   … -- --models=claude-haiku-5-5 --efforts=off,low --strategies=retrieve --cases=T1,L1
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	imagePart,
	LABEL_CASES,
	type LabelCase,
	MEAL_CASES,
	type MealCase,
	mealParts,
} from "./cases";
import {
	type LabelResult,
	type MealResult,
	type RunConfig,
	runLabel,
	runMeal,
	type Strategy,
} from "./flows";
import { type Effort, providerFor } from "./provider";

const args = Object.fromEntries(
	process.argv
		.slice(2)
		.filter((a) => a.startsWith("--"))
		.map((a) => {
			const [k, v] = a.slice(2).split("=");
			return [k, v?.split(",") ?? []];
		}),
);
const models = args.models ?? ["claude-haiku-5-5", "claude-sonnet-5-5"];
const efforts = (args.efforts ?? ["off", "low", "medium", "high"]) as Effort[];
const strategies = (args.strategies ?? [
	"retrieve",
	"catalog",
	"freeform",
]) as Strategy[];
const caseFilter = args.cases;
const concurrency = Number(args.concurrency?.[0] ?? 6);
const provider = providerFor(args.provider?.[0] ?? "anthropic");

type Row = {
	case: string;
	model: string;
	effort: Effort;
	strategy: Strategy | "label";
	pass: boolean;
	failures: string[];
	kcal: number | null;
	costUsd: number;
	ms: number;
	summary: string;
	error?: string;
	result?: unknown;
};

function gradeLabel(c: LabelCase, r: LabelResult): string[] {
	const f: string[] = [];
	if (!c.expect) {
		if (r.data.is_label) f.push("accepted a non-label");
		return f;
	}
	if (!r.data.is_label) return ["rejected a real label"];
	for (const [key, want] of Object.entries(c.expect.per100)) {
		const got = r.data.per100[key as keyof typeof r.data.per100];
		if (got !== want) f.push(`${key} ${got}≠${want}`);
	}
	if (r.data.serving?.amount !== c.expect.serving)
		f.push(`serving ${r.data.serving?.amount}`);
	if (r.data.pack_size?.amount !== c.expect.pack)
		f.push(`pack ${r.data.pack_size?.amount}`);
	if (!c.expect.brand.test(r.data.brand ?? "")) f.push(`brand ${r.data.brand}`);
	if ((r.data.barcode ?? "").replace(/\D/g, "") !== c.expect.barcode)
		f.push(`barcode ${r.data.barcode}`);
	return f;
}

function gradeMeal(c: MealCase, r: MealResult): string[] {
	const f: string[] = [];
	if (c.noFood) {
		if (r.status !== "no_food" || r.items.length) f.push("did not reject");
		return f;
	}
	if (r.status === "no_food") return ["rejected real food"];
	const names = r.items.map((i) =>
		r.strategy === "freeform" ? "" : (i.foodName ?? ""),
	);
	if (r.strategy !== "freeform") {
		for (const concept of c.concepts)
			if (!names.some((n) => concept.test(n)))
				f.push(`missing ${concept.source}`);
		for (const bad of c.forbid ?? [])
			for (const n of names) if (bad.test(n)) f.push(`implausible: ${n}`);
		const unmatched = r.items.filter((i) => !i.ref).length;
		if (unmatched) f.push(`${unmatched} unmatched`);
	}
	if (
		c.refPrefix &&
		r.strategy !== "freeform" &&
		!r.items.some((i) => i.ref?.startsWith(c.refPrefix!))
	)
		f.push(`no ${c.refPrefix} ref`);
	if (c.kcal) {
		const kcal = r.totals.energy;
		if (kcal < c.kcal[0] || kcal > c.kcal[1])
			f.push(`kcal ${kcal.toFixed(0)} ∉ [${c.kcal.join("–")}]`);
	}
	if (c.lowConfidence && !r.items.some((i) => i.confidence !== "high"))
		f.push("no uncertainty flagged");
	return f;
}

type Job = () => Promise<Row>;
const jobs: Job[] = [];
/** Model name for catalog jobs, else null — used to warm the cache. */
const warmable: (string | null)[] = [];

for (const model of models)
	for (const effort of efforts) {
		const config: RunConfig = { provider, model, effort };
		for (const c of LABEL_CASES) {
			if (caseFilter && !caseFilter.includes(c.id)) continue;
			warmable.push(null);
			jobs.push(async () => {
				const base = { case: c.id, model, effort, strategy: "label" as const };
				try {
					const r = await runLabel(config, imagePart(c.file));
					const failures = gradeLabel(c, r);
					const p = r.data.per100;
					return {
						...base,
						pass: failures.length === 0,
						failures,
						kcal: p.energy_kcal,
						costUsd: r.calls[0].costUsd,
						ms: r.calls[0].ms,
						summary: r.data.is_label
							? `${p.energy_kcal}kcal P${p.protein} C${p.carbs} F${p.fat} salt${p.salt}`
							: "not a label",
						result: r,
					};
				} catch (error) {
					return {
						...base,
						pass: false,
						failures: ["error"],
						kcal: null,
						costUsd: 0,
						ms: 0,
						summary: "",
						error: String(error),
					};
				}
			});
		}
		for (const strategy of strategies)
			for (const c of MEAL_CASES) {
				if (caseFilter && !caseFilter.includes(c.id)) continue;
				warmable.push(strategy === "catalog" ? model : null);
				jobs.push(async () => {
					const base = { case: c.id, model, effort, strategy };
					try {
						const r = await runMeal(config, mealParts(c), strategy);
						const failures = gradeMeal(c, r);
						return {
							...base,
							pass: failures.length === 0,
							failures,
							kcal: Math.round(r.totals.energy),
							costUsd: r.costUsd,
							ms: r.ms,
							summary: r.items
								.map((i) => `${i.grams}g ${i.foodName ?? i.description}`)
								.join("; "),
							result: r,
						};
					} catch (error) {
						return {
							...base,
							pass: false,
							failures: ["error"],
							kcal: null,
							costUsd: 0,
							ms: 0,
							summary: "",
							error: String(error),
						};
					}
				});
			}
	}

console.error(`${jobs.length} runs, concurrency ${concurrency}`);
const rows: Row[] = [];
// Prompt caches are per model: run one catalog job per model first so the
// rest read the 51k-token catalog from cache instead of all writing it.
for (const model of models) {
	const index = jobs.findIndex((_, i) => warmable[i] === model);
	if (index >= 0) {
		rows.push(await jobs[index]());
		jobs.splice(index, 1);
		warmable.splice(index, 1);
		process.stderr.write("w");
	}
}
let next = 0;
await Promise.all(
	Array.from({ length: concurrency }, async () => {
		while (next < jobs.length) {
			const job = jobs[next++];
			const row = await job();
			rows.push(row);
			process.stderr.write(row.pass ? "." : row.error ? "E" : "x");
		}
	}),
);
console.error("");

const order = (r: Row) =>
	`${r.model}|${["off", "low", "medium", "high"].indexOf(r.effort)}|${r.strategy}|${r.case}`;
rows.sort((a, b) => order(a).localeCompare(order(b)));

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, "out"), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(
	join(here, "out", `eval-${stamp}.json`),
	JSON.stringify(rows, null, 2),
);

// Detail table
console.log(
	"\n| config | strategy | case | pass | kcal | $ | s | failures / summary |\n|---|---|---|---|---|---|---|---|",
);
for (const r of rows)
	console.log(
		`| ${r.model.replace("claude-", "")} ${r.effort} | ${r.strategy} | ${r.case} | ${r.pass ? "✅" : "❌"} | ${r.kcal ?? ""} | ${r.costUsd.toFixed(4)} | ${(r.ms / 1000).toFixed(1)} | ${r.error ?? (r.failures.join(", ") || r.summary).slice(0, 140)} |`,
	);

// Summary per config × strategy
console.log(
	"\n| model | effort | strategy | pass | total $ | avg $/run | avg s |\n|---|---|---|---|---|---|---|",
);
const groups = new Map<string, Row[]>();
for (const r of rows) {
	const key = `${r.model}|${r.effort}|${r.strategy}`;
	groups.set(key, [...(groups.get(key) ?? []), r]);
}
for (const [key, list] of groups) {
	const [model, effort, strategy] = key.split("|");
	const cost = list.reduce((a, r) => a + r.costUsd, 0);
	const ms = list.reduce((a, r) => a + r.ms, 0) / list.length;
	console.log(
		`| ${model.replace("claude-", "")} | ${effort} | ${strategy} | ${list.filter((r) => r.pass).length}/${list.length} | ${cost.toFixed(4)} | ${(cost / list.length).toFixed(5)} | ${(ms / 1000).toFixed(1)} |`,
	);
}
